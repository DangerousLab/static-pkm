/**
 * Central state management for the application
 * All shared state variables and constants
 */

export const state = {
  activeInstance: null,
  activeNode: null,
  baseSidebarWidth: 240,
  hoverSidebarWidth: 240,
  hoverNeeded: false,
  searchIndex: [],
  selectedResultIndex: -1,
  moduleDisplayNames: {},
  preloadedModules: new Set(),
  navigationTree: null,
  currentFolder: null,
  loadedScripts: new Set(),
  moduleFactories: new Map(),
  moduleReadyCallbacks: new Map(),
  // Cache computed widths per folder path
  folderWidthCache: new Map(),
  // In-memory cache of fetched module code
  moduleCodeCache: new Map(), // scriptUrl -> code string
  // Track in-progress preload operations
  preloadPromises: new Map(), // scriptUrl -> Promise<code>
};



export const themeController = {
  getTheme() {
    return document.documentElement.getAttribute("data-theme") || "dark";
  },
  subscribe(fn) {
    document.addEventListener("themechange", fn);
    return () => document.removeEventListener("themechange", fn);
  },
};

// Export DOM references (initialized after DOM is ready)
export const dom = {
  htmlEl: document.documentElement,
  sidebar: null,
  sidebarToggle: null,
  sidebarNav: null,
  sidebarBreadcrumb: null,
  card: null,
  themeToggleBtn: null,
  themeIcon: null,
  searchInput: null,
  searchClear: null,
  searchResults: null,
  mainContent: null,
};

// Initialize DOM references when DOM is ready
export function initDOMRefs() {
  dom.sidebar = document.getElementById("sidebar");
  dom.sidebarToggle = document.getElementById("sidebarToggle");
  dom.sidebarNav = document.getElementById("sidebarNav");
  dom.sidebarBreadcrumb = document.getElementById("sidebarBreadcrumb");
  dom.card = document.getElementById("contentCard");
  dom.themeToggleBtn = document.getElementById("themeToggle");
  dom.themeIcon = document.getElementById("themeIcon");
  dom.searchInput = document.getElementById("searchInput");
  dom.searchClear = document.getElementById("searchClear");
  dom.searchResults = document.getElementById("searchResults");
  dom.mainContent = document.querySelector(".main-content");
}