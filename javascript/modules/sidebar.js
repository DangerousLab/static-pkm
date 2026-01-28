/**
 * Sidebar management module
 * Handles sidebar width application and hover behavior
 * Width computation is now done during preload (cached)
 */

import { dom, state } from '../core/state.js';
import { isDesktopOrTablet } from '../core/utils.js';

// Track hover state explicitly
let isCurrentlyHovering = false;

/**
 * Apply sidebar width based on current hover state
 * Uses pre-computed cached values from preloader
 */
export function applySidebarWidth() {
  if (!isDesktopOrTablet()) return;
  if (dom.sidebar.getAttribute("data-open") !== "true") return;

  // Use tracked hover state and cached values
  if (isCurrentlyHovering && state.hoverNeeded) {
    dom.sidebar.style.width = state.hoverSidebarWidth + "px";
    console.log('[Sidebar] Applied cached hover width:', state.hoverSidebarWidth);
  } else {
    dom.sidebar.style.width = state.baseSidebarWidth + "px";
    console.log('[Sidebar] Applied base width:', state.baseSidebarWidth);
  }
}

/**
 * Toggle sidebar open/closed state
 */
export function toggleSidebar() {
  const isOpen = dom.sidebar.getAttribute("data-open") === "true";
  const next = !isOpen;

  if (isDesktopOrTablet()) {
    if (next) {
      dom.sidebar.setAttribute("data-open", "true");
      dom.sidebarToggle.setAttribute("data-open", "true");
      dom.sidebar.style.width = state.baseSidebarWidth + "px";
    } else {
      const currentWidth = dom.sidebar.getBoundingClientRect().width;
      dom.sidebar.style.width = currentWidth + "px";
      dom.sidebar.setAttribute("data-open", "false");
      dom.sidebarToggle.setAttribute("data-open", "false");

      // Reset hover state when closing
      isCurrentlyHovering = false;

      setTimeout(() => {
        if (dom.sidebar.getAttribute("data-open") !== "true") {
          dom.sidebar.style.width = "";
        }
      }, 250);
    }
  } else {
    dom.sidebar.setAttribute("data-open", String(next));
    dom.sidebarToggle.setAttribute("data-open", String(next));
  }
}

/**
 * Clear active state from all sidebar items
 */
export function clearSidebarActive() {
  const items = dom.sidebarNav.querySelectorAll(".nav-item");
  items.forEach((b) => b.classList.remove("active"));
}

/**
 * Handle sidebar mouse enter event
 */
function handleSidebarMouseEnter() {
  if (!isDesktopOrTablet()) return;
  if (dom.sidebar.getAttribute("data-open") !== "true") return;

  isCurrentlyHovering = true;
  console.log('[Sidebar] Mouse enter - using cached hoverNeeded:', state.hoverNeeded);

  if (!state.hoverNeeded) {
    dom.sidebar.style.width = state.baseSidebarWidth + "px";
    return;
  }
  dom.sidebar.style.width = state.hoverSidebarWidth + "px";
}

/**
 * Handle sidebar mouse leave event
 */
function handleSidebarMouseLeave(e) {
  if (!isDesktopOrTablet()) return;
  if (dom.sidebar.getAttribute("data-open") !== "true") return;

  const related = e.relatedTarget;
  if (related && dom.sidebar.contains(related)) {
    return;
  }

  isCurrentlyHovering = false;
  console.log('[Sidebar] Mouse leave - resetting to base width');
  dom.sidebar.style.width = state.baseSidebarWidth + "px";
}

/**
 * Initialize sidebar event listeners
 */
export function initSidebar() {
  dom.sidebarToggle.addEventListener("click", toggleSidebar);
  dom.sidebar.addEventListener("mouseenter", handleSidebarMouseEnter);
  dom.sidebar.addEventListener("mouseleave", handleSidebarMouseLeave);
}