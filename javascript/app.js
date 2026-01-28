/**
 * Main application entry point
 * Orchestrates all modules and handles initialization
 */

import { dom, state, initDOMRefs } from './core/state.js';
import { notifyModuleReady, isDesktopOrTablet, isMediumViewport } from './core/utils.js';
import { initTheme } from './modules/theme.js';
import { initSidebar, toggleSidebar } from './modules/sidebar.js';
import { renderSidebar } from './modules/navigation.js';
import { openNode } from './modules/content-loader.js';
import { preloadFolderModules, getInitialFolder } from './modules/preloader.js';
import { initSearch, rebuildSearchIndex } from './modules/search.js';

(function () {
  "use strict";

  console.log('[App] Initializing application...');

  // Register global module ready notification
  window.__moduleReady = notifyModuleReady;

  /**
   * Initialize application on page load
   */
  window.addEventListener("load", () => {
    console.log('[App] Page loaded, initializing DOM references');
    
    // Initialize DOM references first
    initDOMRefs();

    // Initialize all modules
    initTheme();
    initSidebar();
    initSearch();

    console.log('[App] Fetching navigation tree');

    // Load navigation tree from static JSON
    fetch("./javascript/tree.json")
      .then((res) => {
        if (!res.ok) {
          throw new Error("Failed to load navigation tree");
        }
        return res.json();
      })
      .then((tree) => {
        console.log('[App] Navigation tree loaded');
        state.navigationTree = tree;

        const initialFolder = getInitialFolder(state.navigationTree);

        renderSidebar(initialFolder);
        preloadFolderModules(initialFolder);

        // Build search index after tree is loaded
        rebuildSearchIndex();

        // Default node: first module/page/document directly under that folder
        let defaultNode = null;
        if (initialFolder.children) {
          defaultNode =
            initialFolder.children.find(
              (c) =>
                c.type === "module" ||
                c.type === "page" ||
                c.type === "document"
            ) || null;
        }

        if (defaultNode) {
          const defaultBtn = dom.sidebarNav.querySelector(
            '.nav-item[data-type="' +
              defaultNode.type +
              '"][data-id="' +
              defaultNode.id +
              '"]'
          );
          if (defaultBtn) {
            defaultBtn.classList.add("active");
          }
          openNode(defaultNode);
        } else {
          dom.card.classList.remove("preload");
          dom.card.classList.add("loaded");
        }
      })
      .catch((err) => {
        console.error('[App] Failed to load navigation tree:', err);
        dom.card.classList.remove("preload");
        dom.card.classList.add("loaded");
      });
  });

  /**
   * Handle window resize
   */
  window.addEventListener("resize", () => {
    if (!isDesktopOrTablet()) {
      dom.sidebar.style.width = "";
    } else {
      if (dom.sidebar.getAttribute("data-open") === "true") {
        dom.sidebar.style.width = state.baseSidebarWidth + "px";
      } else {
        dom.sidebar.style.width = "";
      }
    }
  });

  /**
   * Auto-collapse sidebar when clicking on main content (for medium viewports/tablets)
   */
  document.addEventListener("DOMContentLoaded", () => {
    initDOMRefs();
    
    if (dom.card) {
      dom.card.addEventListener("click", () => {
        if (isMediumViewport() && dom.sidebar.getAttribute("data-open") === "true") {
          toggleSidebar();
        }
      });
    }

    if (dom.mainContent) {
      dom.mainContent.addEventListener("click", (e) => {
        if (e.target === dom.mainContent || e.target.classList.contains("page-root")) {
          if (isMediumViewport() && dom.sidebar.getAttribute("data-open") === "true") {
            toggleSidebar();
          }
        }
      });
    }
  });

  console.log('[App] Initialization complete');
})();