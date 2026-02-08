/**
 * Navigation module
 * Handles breadcrumb and sidebar navigation rendering
 */

import { dom, state } from '../core/state.js';
import { findNodeByPath, findLeafById } from '../core/utils.js';
import { clearSidebarActive, applySidebarWidth, toggleSidebar } from './sidebar.js';
import { openNode } from './content-loader.js';
import { isDesktopOrTablet } from '../core/utils.js';
import { loadFontAwesome, getTypeIcon } from '../loader/fontawesome-loader.js'; 

// Track if icons have been loaded for navigation
let iconsLoaded = false;

/**
 * Ensure FontAwesome is loaded before rendering navigation icons
 */
async function ensureIconsLoaded() {
  if (iconsLoaded) return;
  
  console.log('[Navigation] Loading FontAwesome icons');
  await loadFontAwesome();
  iconsLoaded = true;
}

/**
 * Render breadcrumb navigation
 */
export function renderBreadcrumb() {
  if (!state.navigationTree || !state.currentFolder) return;
  if (!dom.sidebarBreadcrumb) return;

  dom.sidebarBreadcrumb.innerHTML = "";

  const fullPath = state.currentFolder.path || "Home";
  const segments = fullPath.split("/");

  segments.forEach((segment, index) => {
    const isLast = index === segments.length - 1;
    const path = segments.slice(0, index + 1).join("/");

    const part = document.createElement("span");
    part.textContent = segment;
    part.className = "sidebar-breadcrumb-part" + (isLast ? " current" : "");

    if (!isLast) {
      part.addEventListener("click", () => {
        if (path === state.currentFolder.path) return;
        const node = findNodeByPath(state.navigationTree, path);
        if (!node || node.type !== "folder") return;

        navigateToFolder(node);
      });
    }

    dom.sidebarBreadcrumb.appendChild(part);

    if (!isLast) {
      const sep = document.createElement("span");
      sep.textContent = "/";
      sep.className = "sidebar-breadcrumb-separator";
      dom.sidebarBreadcrumb.appendChild(sep);
    }
  });
}

/**
 * Navigate to a folder - unified function for all folder navigation
 * This triggers all necessary actions: render sidebar, preload, calculate width
 */
export async function navigateToFolder(folderNode) { 
  console.log('[Navigation] Navigating to folder:', folderNode.path || 'Home');
  await renderSidebar(folderNode); 
  window.dispatchEvent(new CustomEvent('folderNavigated', {
    detail: { folderNode }
  }));
}

export async function renderSidebar(folderNode) {
  console.log('[Navigation] Rendering sidebar for folder:', folderNode.path || 'Home');
  
  // Only load icons if sidebar content is initialized (user has opened sidebar)
  // This prevents loading FontAwesome on initial page load
  if (typeof window !== 'undefined') { 
    const sidebarModule = await import('./sidebar.js');
    if (sidebarModule.isSidebarContentInitialized && sidebarModule.isSidebarContentInitialized()) {
      await ensureIconsLoaded();
    }
  }
  
  state.currentFolder = folderNode;
  dom.sidebarNav.innerHTML = "";

  renderBreadcrumb();

  const items = [];

  // Add "Back" button if not at root
  if (folderNode !== state.navigationTree) {
    const parentPath = folderNode.path.split("/").slice(0, -1).join("/");
    const parentNode = findNodeByPath(state.navigationTree, parentPath);
    if (parentNode) {
      const upItem = document.createElement("button");
      upItem.type = "button";
      upItem.className = "nav-item";
      upItem.setAttribute("data-type", "folder");
      upItem.setAttribute("data-path", parentNode.path);
      upItem.innerHTML = `
        <span class="nav-index"></span>
        <span class="nav-icon">${getTypeIcon("back")}</span>
        <span class="nav-label">Back</span>
      `;
      items.push(upItem);
    }
  }

  // Add folder children
  if (folderNode.children) {
    folderNode.children.forEach((child, index) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "nav-item";

      if (child.type === "folder") {
        btn.setAttribute("data-type", "folder");
        btn.setAttribute("data-path", child.path);
        btn.innerHTML = `
          <span class="nav-index">${String(index + 1).padStart(2, "0")}</span>
          <span class="nav-icon">${getTypeIcon("folder")}</span>
          <span class="nav-label">${child.name}</span>
        `;
      } else {
        // module, page, document
        btn.setAttribute("data-type", child.type);
        btn.setAttribute("data-id", child.id);
        const label =
          state.moduleDisplayNames[child.id] ||
          child.title ||
          child.id ||
          "Loading";
        btn.innerHTML = `
          <span class="nav-index">${String(index + 1).padStart(2, "0")}</span>
          <span class="nav-icon">${getTypeIcon(child.type)}</span>
          <span class="nav-label">${label}</span>
        `;

        if (state.activeNode && state.activeNode.id === child.id) {
          btn.classList.add("active");
        }
      }

      items.push(btn);
    });
  }

  items.forEach((btn) => dom.sidebarNav.appendChild(btn));

  // Add click event listeners
  dom.sidebarNav.querySelectorAll(".nav-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      const type = btn.getAttribute("data-type");

      if (type === "folder") {
        const path = btn.getAttribute("data-path");
        if (!path) return;
        const node = findNodeByPath(state.navigationTree, path);
        if (!node) return;

        navigateToFolder(node);
        return;
      }

      if (type === "module" || type === "page" || type === "document") {
        const id = btn.getAttribute("data-id");
        if (!id) return;
        const node = findLeafById(state.navigationTree, id);
        if (!node) return;

        clearSidebarActive();
        btn.classList.add("active");
        openNode(node);

        if (!isDesktopOrTablet()) {
          toggleSidebar();
        }
      }
    });
  });

  // Apply cached width (no measurement needed!)
  console.log('[Navigation] Applying cached width values');
  applySidebarWidth();
}