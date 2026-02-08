/**
 * Search functionality module
 * Handles search indexing, querying, and results display
 */

import { dom, state } from '../core/state.js';
import { findNodeByPath, findParentFolder, getTypeIcon, isDesktopOrTablet } from '../core/utils.js';
import { navigateToFolder } from './navigation.js';
import { clearSidebarActive, toggleSidebar } from './sidebar.js';
import { openNode } from './content-loader.js';

/**
 * Build searchable index from navigation tree
 */
export function buildSearchIndex(node, pathArray = [], parentNode = null) {
  const index = [];

  if (!node) return index;

  const currentPath = pathArray.length > 0 ? pathArray.join(" > ") : "";

  // Index folders
  if (node.type === "folder" && node.name) {
    index.push({
      type: "folder",
      name: node.name,
      path: node.path,
      displayPath: currentPath,
      searchText: node.name.toLowerCase(),
      node: node,
      parentNode: parentNode
    });
  }

  // Index modules, pages, documents
  if (node.type === "module" || node.type === "page" || node.type === "document") {
    const title = state.moduleDisplayNames[node.id] || node.title || node.id || "";
    const tags = (node.tags || []).join(" ").toLowerCase();

    index.push({
      type: node.type,
      id: node.id,
      title: title,
      path: node.path,
      displayPath: currentPath,
      searchText: (title + " " + tags).toLowerCase(),
      node: node,
      parentNode: parentNode
    });
  }

  // Recursively index children
  if (node.children && node.children.length > 0) {
    const newPath = node.name ? [...pathArray, node.name] : pathArray;
    node.children.forEach(child => {
      index.push(...buildSearchIndex(child, newPath, node));
    });
  }

  return index;
}

/**
 * Rebuild the search index
 */
export function rebuildSearchIndex() {
  if (!state.navigationTree) return;
  state.searchIndex = buildSearchIndex(state.navigationTree);
  console.log('[Search] Index rebuilt with', state.searchIndex.length, 'items');
}

/**
 * Score a search match
 */
function scoreMatch(searchText, query) {
  const lowerQuery = query.toLowerCase();
  const lowerText = searchText.toLowerCase();

  // Exact match gets highest score
  if (lowerText === lowerQuery) return 1000;

  // Starts with query
  if (lowerText.startsWith(lowerQuery)) return 500;

  // Contains query as whole word
  const words = lowerText.split(/\s+/);
  for (const word of words) {
    if (word.startsWith(lowerQuery)) return 300;
    if (word.includes(lowerQuery)) return 150;
  }

  // Contains query anywhere (substring match)
  if (lowerText.includes(lowerQuery)) return 100;

  return 0;
}

/**
 * Search items in the index
 */
function searchItems(query) {
  if (!query || query.trim().length < 2) return [];

  const trimmedQuery = query.trim();
  const results = [];

  state.searchIndex.forEach(item => {
    const score = scoreMatch(item.searchText, trimmedQuery);
    if (score > 0) {
      results.push({ ...item, score });
    }
  });

  // Sort by score (highest first), then alphabetically
  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const aName = a.title || a.name || "";
    const bName = b.title || b.name || "";
    return aName.localeCompare(bName);
  });

  return results.slice(0, 15);
}

/**
 * Highlight matching text in search results
 */
function highlightMatch(text, query) {
  if (!query || !text) return text;

  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const index = lowerText.indexOf(lowerQuery);

  if (index === -1) return text;

  const before = text.substring(0, index);
  const match = text.substring(index, index + query.length);
  const after = text.substring(index + query.length);

  return before + '<span class="search-match">' + match + '</span>' + after;
}

/**
 * Render search results
 */
function renderSearchResults(results, query) {
  state.selectedResultIndex = -1;

  if (results.length === 0) {
    dom.searchResults.innerHTML = '<div class="search-no-results">No results found</div>';
    dom.searchResults.style.display = "block";
    return;
  }

  const html = results.map((item, index) => {
    const displayName = item.title || item.name || "";
    const highlightedName = highlightMatch(displayName, query);
    const icon = getTypeIcon(item.type);

    return `
      <div class="search-result-item" data-index="${index}">
        <div class="search-result-title">
          <span class="search-result-icon">${icon}</span>
          <span>${highlightedName}</span>
        </div>
        ${item.displayPath ? `<div class="search-result-path">${item.displayPath}</div>` : ""}
      </div>
    `;
  }).join("");

  dom.searchResults.innerHTML = html;
  dom.searchResults.style.display = "block";

  // Add click listeners
  dom.searchResults.querySelectorAll(".search-result-item").forEach((el, index) => {
    el.addEventListener("click", () => {
      handleResultSelection(results[index]);
    });
  });
}

/**
 * Handle selection of a search result
 */
function handleResultSelection(item) {
  console.log('[Search] Selected item:', item);
  
  if (!item || !item.node) {
    console.error('[Search] Invalid item or node');
    return;
  }

  if (item.type === "folder") {
    // Navigate to folder using unified function
    console.log('[Search] Navigating to folder:', item.node.path);
    navigateToFolder(item.node);
  } else {
    // For modules/pages/documents - use stored parent from index
    let parentNode = item.parentNode;
    
    console.log('[Search] Item details:', {
      itemType: item.type,
      itemPath: item.path,
      itemNode: item.node,
      parentNode: parentNode
    });

    if (parentNode && parentNode.type === 'folder') {
      console.log('[Search] Navigating to parent folder:', parentNode.path || 'Home');
      
      // Navigate to parent folder (triggers all folder navigation actions)
      navigateToFolder(parentNode);
      
      // Wait for folder navigation to complete, then open the item
      requestAnimationFrame(() => {
        console.log('[Search] Opening item:', item.node.id);
        clearSidebarActive();
        openNode(item.node);

        // Highlight the active item in sidebar after opening
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const navItem = dom.sidebarNav.querySelector(
              '.nav-item[data-type="' + item.node.type + '"][data-id="' + item.node.id + '"]'
            );
            if (navItem) {
              navItem.classList.add("active");
              console.log('[Search] Activated nav item');
            } else {
              console.warn('[Search] Could not find nav item for', item.node.id);
            }
          });
        });
      });
    } else {
      console.error('[Search] Could not find valid parent folder');
    }
  }

  // Clear search UI
  dom.searchInput.value = "";
  dom.searchClear.style.display = "none";
  dom.searchResults.style.display = "none";
  dom.searchResults.innerHTML = "";

  // Close sidebar on mobile
  if (!isDesktopOrTablet()) {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => toggleSidebar());
    });
  }
}

/**
 * Update selected result with keyboard navigation
 */
function updateSelectedResult(direction) {
  const items = dom.searchResults.querySelectorAll(".search-result-item");
  if (items.length === 0) return;

  // Remove previous selection
  if (state.selectedResultIndex >= 0 && state.selectedResultIndex < items.length) {
    items[state.selectedResultIndex].classList.remove("selected");
  }

  // Update index
  if (direction === "down") {
    state.selectedResultIndex = (state.selectedResultIndex + 1) % items.length;
  } else if (direction === "up") {
    state.selectedResultIndex = state.selectedResultIndex <= 0 ? items.length - 1 : state.selectedResultIndex - 1;
  }

  // Add new selection
  if (state.selectedResultIndex >= 0 && state.selectedResultIndex < items.length) {
    items[state.selectedResultIndex].classList.add("selected");
    items[state.selectedResultIndex].scrollIntoView({ block: "nearest" });
  }
}

/**
 * Initialize search functionality
 */
export function initSearch() {
  let searchDebounceTimer = null;

  dom.searchInput.addEventListener("input", (e) => {
    const query = e.target.value;

    // Show/hide clear button
    dom.searchClear.style.display = query.length > 0 ? "flex" : "none";

    // Debounce search
    clearTimeout(searchDebounceTimer);

    if (query.trim().length === 0) {
      dom.searchResults.style.display = "none";
      dom.searchResults.innerHTML = "";
      return;
    }

    searchDebounceTimer = setTimeout(() => {
      const results = searchItems(query);
      renderSearchResults(results, query);
    }, 200);
  });

  dom.searchInput.addEventListener("keydown", (e) => {
    const resultsVisible = dom.searchResults.style.display === "block";

    if (e.key === "Escape") {
      dom.searchInput.value = "";
      dom.searchClear.style.display = "none";
      dom.searchResults.style.display = "none";
      dom.searchResults.innerHTML = "";
      dom.searchInput.blur();
    } else if (e.key === "ArrowDown" && resultsVisible) {
      e.preventDefault();
      updateSelectedResult("down");
    } else if (e.key === "ArrowUp" && resultsVisible) {
      e.preventDefault();
      updateSelectedResult("up");
    } else if (e.key === "Enter" && resultsVisible) {
      e.preventDefault();
      const results = searchItems(dom.searchInput.value);
      if (state.selectedResultIndex >= 0 && state.selectedResultIndex < results.length) {
        handleResultSelection(results[state.selectedResultIndex]);
      } else if (results.length > 0) {
        handleResultSelection(results[0]);
      }
    }
  });

  dom.searchClear.addEventListener("click", () => {
    dom.searchInput.value = "";
    dom.searchClear.style.display = "none";
    dom.searchResults.style.display = "none";
    dom.searchResults.innerHTML = "";
    dom.searchInput.focus();
  });

  // Keyboard Shortcut: Ctrl+K or Cmd+K to Focus Search
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "k") {
      e.preventDefault();
      dom.searchInput.focus();

      // Open sidebar if closed
      if (dom.sidebar.getAttribute("data-open") !== "true") {
        toggleSidebar();
      }
    }
  });

  // Close Search Results When Clicking Outside
  document.addEventListener("click", (e) => {
    if (!dom.searchInput.contains(e.target) &&
        !dom.searchResults.contains(e.target) &&
        !dom.searchClear.contains(e.target)) {
      if (dom.searchResults.style.display === "block") {
        dom.searchResults.style.display = "none";
      }
    }
  });
}

/**
 * Initialize search event listeners
 * Call this from app.js after all modules are loaded
 */
export function initSearchEventListeners() {
  // Listen for search index rebuild requests
  window.addEventListener('searchIndexRebuildNeeded', () => {
    console.log('[Search] Received searchIndexRebuildNeeded event');
    rebuildSearchIndex();
  });
  
  // Listen for sidebar render requests (to rebuild search index after)
  window.addEventListener('sidebarRenderNeeded', (event) => {
    const { folderNode } = event.detail;
    console.log('[Search] Received sidebarRenderNeeded event');
    // Import and call renderSidebar dynamically to avoid circular dependency at module load time
    import('./navigation.js').then(nav => {
      nav.renderSidebar(folderNode);
    });
  });
  
  console.log('[Search] Event listeners initialized');
}