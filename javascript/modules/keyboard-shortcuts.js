// FILE: javascript/modules/keyboard-shortcuts.js | NEW FILE

/**
 * Centralized keyboard shortcut management
 * Handles all global keyboard shortcuts for the application
 */

import { dom } from '../core/state.js';
import { toggleSidebar, isSidebarContentInitialized } from './sidebar.js';

/**
 * Initialize all keyboard shortcuts
 * Call early in app.js to register shortcuts before lazy-loaded modules
 */
export function initKeyboardShortcuts() {
  console.log('[Shortcuts] Initializing keyboard shortcuts');

  // Ctrl+K or Cmd+K: Focus Search
  document.addEventListener("keydown", async (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "k") {
      e.preventDefault();
      
      // Open sidebar if closed (triggers lazy loading of search UI)
      if (dom.sidebar.getAttribute("data-open") !== "true") {
        await toggleSidebar();
      }
      
      // Wait for search UI to be initialized (if first time)
      // Give time for lazy loading to complete
      await new Promise(resolve => {
        if (isSidebarContentInitialized()) {
          resolve();
        } else {
          // Wait for next frame after sidebar opens
          requestAnimationFrame(() => {
            requestAnimationFrame(resolve);
          });
        }
      });
      
      // Focus search input
      if (dom.searchInput) {
        dom.searchInput.focus();
        console.log('[Shortcuts] Search focused via Ctrl+K');
      }
    }
  });

  console.log('[Shortcuts] Registered: Ctrl+K (Focus Search)');
}

// Future shortcuts can be added here:
// registerShortcut('Ctrl+N', 'New note', () => { ... });
// registerShortcut('Ctrl+/', 'Toggle help', () => { ... });