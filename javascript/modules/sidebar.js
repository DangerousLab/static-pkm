/**
 * Sidebar management module
 * Handles sidebar width application and hover behavior
 * Width computation is now done during preload (cached)
 */

import { dom, state } from '../core/state.js';
import { isDesktopOrTablet } from '../core/utils.js';
import { loadFontAwesome } from '../utilities/fontawesome-loader.js';

// Track hover state explicitly
let isCurrentlyHovering = false;

// Track if sidebar content has been initialized
let sidebarContentInitialized = false;

/**
 * Check if in landscape mode
 */
function isLandscapeMode() {
  return window.matchMedia('(max-height: 600px) and (orientation: landscape)').matches;
}

/**
 * Apply sidebar width based on current hover state
 * Uses pre-computed cached values from preloader
 */
export function applySidebarWidth() {
  // Skip width application in landscape mode (CSS handles it)
  if (isLandscapeMode()) return;
  
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
export async function toggleSidebar() { 
  const isOpen = dom.sidebar.getAttribute("data-open") === "true";
  const next = !isOpen;
  
  // Initialize sidebar content on first open
  if (next && !sidebarContentInitialized) { 
    console.log('[Sidebar] First open - initializing content with icons');
    await initSidebarSearch();  // Load FontAwesome + inject search HTML
    sidebarContentInitialized = true;
  }

  // In landscape mode, use simpler toggle (CSS handles positioning)
  if (isLandscapeMode()) {
    dom.sidebar.setAttribute("data-open", String(next));
    dom.sidebarToggle.setAttribute("data-open", String(next));
    
    const landscapeToggle = document.getElementById('landscapeToggle');
    if (landscapeToggle) {
      landscapeToggle.setAttribute("data-open", String(next));
    }
    return;
  }

  if (isDesktopOrTablet()) {
    if (next) {
      dom.sidebar.setAttribute("data-open", "true");
      dom.sidebarToggle.setAttribute("data-open", "true");
      
      // Sync landscape toggle if exists
      const landscapeToggle = document.getElementById('landscapeToggle');
      if (landscapeToggle) {
        landscapeToggle.setAttribute("data-open", "true");
      }
      
      dom.sidebar.style.width = state.baseSidebarWidth + "px";
    } else {
      const currentWidth = dom.sidebar.getBoundingClientRect().width;
      dom.sidebar.style.width = currentWidth + "px";
      dom.sidebar.setAttribute("data-open", "false");
      dom.sidebarToggle.setAttribute("data-open", "false");
      
      // Sync landscape toggle if exists
      const landscapeToggle = document.getElementById('landscapeToggle');
      if (landscapeToggle) {
        landscapeToggle.setAttribute("data-open", "false");
      }

      // Reset hover state when closing
      isCurrentlyHovering = false;

      dom.sidebar.addEventListener('transitionend', function handler(e) {
        if (e.propertyName === 'transform' && dom.sidebar.getAttribute("data-open") !== "true") {
          dom.sidebar.style.width = "";
        }
        dom.sidebar.removeEventListener('transitionend', handler);
      });
    }
  } else {
    dom.sidebar.setAttribute("data-open", String(next));
    dom.sidebarToggle.setAttribute("data-open", String(next));
    
    // Sync landscape toggle if exists
    const landscapeToggle = document.getElementById('landscapeToggle');
    if (landscapeToggle) {
      landscapeToggle.setAttribute("data-open", String(next));
    }
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
  // Skip hover behavior in landscape mode
  if (isLandscapeMode()) return;
  
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
  // Skip hover behavior in landscape mode
  if (isLandscapeMode()) return;
  
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
 * Initialize sidebar search UI
 * Injects search HTML and loads icons
 */
async function initSidebarSearch() {  // ← ADDED: New function
  const searchContainer = document.querySelector('.sidebar-search');
  if (!searchContainer) {
    console.warn('[Sidebar] .sidebar-search container not found');
    return;
  }
  
  console.log('[Sidebar] Initializing search UI with icons');
  
  // Load FontAwesome first
  await loadFontAwesome();
  
  // Inject search HTML
  searchContainer.innerHTML = `
    <div class="search-input-wrapper">
      <span class="search-icon">
        <i class="fa-solid fa-magnifying-glass"></i>
      </span>
      <input
        type="text"
        id="searchInput"
        class="search-input"
        placeholder="Search (Ctrl+K)"
        aria-label="Search any pages"
        autocomplete="off"
      />
      <button
        id="searchClear"
        class="search-clear"
        type="button"
        aria-label="Clear search"
        style="display: none;"
      >
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>
    <div id="searchResults" class="search-results" style="display: none;"></div>
  `;
  
  // Update DOM refs for search elements (they didn't exist at initial page load)
  dom.searchInput = document.getElementById('searchInput');
  dom.searchClear = document.getElementById('searchClear');
  dom.searchResults = document.getElementById('searchResults');
  
  console.log('[Sidebar] Search UI initialized with updated DOM refs');
  
  // Initialize search event listeners now that HTML exists
  const { initSearch } = await import('./search.js'); 
  initSearch();
  console.log('[Sidebar] Search event listeners attached');
}


/**
 * Initialize sidebar event listeners
 */
export function initSidebar() { 
  // Main sidebar toggle
  dom.sidebarToggle.addEventListener("click", toggleSidebar);
  
  // Landscape left bar sidebar toggle
  const landscapeToggle = document.getElementById('landscapeToggle');
  if (landscapeToggle) {
    landscapeToggle.addEventListener("click", toggleSidebar);
  }
  
  // Hover behavior
  dom.sidebar.addEventListener("mouseenter", handleSidebarMouseEnter);
  dom.sidebar.addEventListener("mouseleave", handleSidebarMouseLeave);
}

/**
 * Check if sidebar content has been initialized
 */
export function isSidebarContentInitialized() {  // ← ADDED: Export state checker
  return sidebarContentInitialized;
}