/**
 * Module preloading system
 * Preloads modules in a folder for better performance
 * Calculates sidebar width from JSON metadata using actual DOM measurement
 */

import { state, themeController } from '../core/state.js';
import { scriptUrlFromFile, factoryNameFromId, waitForFactory } from '../core/utils.js';
import { renderSidebar } from './navigation.js';
import { rebuildSearchIndex } from './search.js';

/**
 * Measure actual width needed for label texts using temporary DOM element
 * This ensures accurate measurement matching real CSS
 */
function measureLabelsWidth(labelTexts) {
  if (labelTexts.length === 0) return 240;

  // Create temporary hidden container
  const tempContainer = document.createElement('div');
  tempContainer.style.position = 'absolute';
  tempContainer.style.left = '-99999px';
  tempContainer.style.top = '-99999px';
  tempContainer.style.visibility = 'hidden';
  tempContainer.style.pointerEvents = 'none';
  document.body.appendChild(tempContainer);

  let maxLabelWidth = 0;

  labelTexts.forEach(text => {
    // Create element with exact same styles as real nav-label
    const label = document.createElement('span');
    label.className = 'nav-label';
    label.textContent = text;
    
    // Apply critical styles that affect width measurement
    label.style.fontSize = '1.2rem';
    label.style.lineHeight = '1.1';
    label.style.whiteSpace = 'nowrap';
    label.style.display = 'inline-block';
    
    tempContainer.appendChild(label);

    // Force reflow to ensure accurate measurement
    void label.offsetWidth;

    const width = label.getBoundingClientRect().width;
    
    if (width > maxLabelWidth) {
      maxLabelWidth = width;
    }

    tempContainer.removeChild(label);
  });

  document.body.removeChild(tempContainer);

  // Calculate total needed width using your formula:
  const navIndexWidth = 24;      // "01", "02" etc
  const navIconWidth = 24;       // icon + margins
  const padding = 12;            // sidebar padding
  const extraMargin = 30;        // safety margin
  
  const totalNeeded = navIndexWidth + navIconWidth + maxLabelWidth + padding + extraMargin;
  
  console.log('[Preloader] Width measurement:', {
    maxLabelWidth: Math.ceil(maxLabelWidth),
    navIndexWidth: navIndexWidth,
    navIconWidth: navIconWidth,
    padding: padding,
    extraMargin: extraMargin,
    totalNeeded: Math.ceil(totalNeeded)
  });

  return Math.ceil(totalNeeded);
}

/**
 * Calculate sidebar width for a folder from JSON metadata
 * Measures actual rendered width using temporary DOM element
 */
function calculateFolderWidth(folderNode) {
  if (!folderNode || !folderNode.children) return { width: 240, hoverNeeded: false };

  const labelTexts = folderNode.children
    .map(child => {
      if (child.type === 'folder') {
        return child.name || '';
      } else if (child.type === 'module' || child.type === 'page' || child.type === 'document') {
        return child.title || child.id || '';
      }
      return '';
    })
    .filter(text => text.length > 0);

  const width = measureLabelsWidth(labelTexts);
  const hoverNeeded = width > state.baseSidebarWidth;

  return { width, hoverNeeded };
}

/**
 * Preload modules in a folder for better performance
 * Width calculation is instant using JSON titles
 */
export function preloadFolderModules(folderNode) {
  if (!folderNode || !folderNode.children) return;

  const folderPath = folderNode.path || 'Home';

  // Calculate and cache width immediately from JSON
  if (!state.folderWidthCache.has(folderPath)) {
    const { width, hoverNeeded } = calculateFolderWidth(folderNode);
    
    state.folderWidthCache.set(folderPath, { width, hoverNeeded });
    state.hoverSidebarWidth = width;
    state.hoverNeeded = hoverNeeded;
    
    console.log('[Preloader] Calculated and cached width for', folderPath, ':', {
      width: width,
      hoverNeeded: hoverNeeded
    });
  } else {
    const cachedWidth = state.folderWidthCache.get(folderPath);
    state.hoverSidebarWidth = cachedWidth.width;
    state.hoverNeeded = cachedWidth.hoverNeeded;
    console.log('[Preloader] Using cached width for', folderPath);
  }

  // Render sidebar immediately with calculated width
  renderSidebar(folderNode);
  rebuildSearchIndex();

  // Now preload modules in background (for faster loading when clicked)
  const modulesToPreload = folderNode.children.filter(
    (child) => child.type === "module" && !state.preloadedModules.has(child.id)
  );
  
  if (modulesToPreload.length === 0) {
    console.log('[Preloader] No modules to preload for', folderPath);
    return;
  }

  console.log('[Preloader] Starting background preload of', modulesToPreload.length, 'modules');

  function preloadNext(index) {
    if (index >= modulesToPreload.length) {
      console.log('[Preloader] All modules preloaded');
      return;
    }

    const mod = modulesToPreload[index];
    const scriptSrc = scriptUrlFromFile(mod.file);

    if (state.loadedScripts.has(scriptSrc)) {
      state.preloadedModules.add(mod.id);
      if (window.requestIdleCallback) {
        requestIdleCallback(() => preloadNext(index + 1));
      } else {
        Promise.resolve().then(() => preloadNext(index + 1));
      }
      return;
    }

    console.log('[Preloader] Loading module', index + 1, '/', modulesToPreload.length, ':', mod.id);

    const script = document.createElement("script");
    script.src = scriptSrc;
    script.defer = true;
    script.dataset.moduleSrc = scriptSrc;

    script.onload = () => {
      state.loadedScripts.add(scriptSrc);

      const factoryName = factoryNameFromId(mod.id);

      waitForFactory(factoryName).then((factory) => {
        if (typeof factory !== "function") {
          console.warn("Factory " + factoryName + " is not a function for module " + mod.id + ". Skipping preload.");
          state.preloadedModules.add(mod.id);
          if (window.requestIdleCallback) {
            requestIdleCallback(() => preloadNext(index + 1));
          } else {
            Promise.resolve().then(() => preloadNext(index + 1));
          }
          return;
        }

        const hiddenRoot = document.createElement("div");
        hiddenRoot.style.position = "absolute";
        hiddenRoot.style.left = "-99999px";
        hiddenRoot.style.top = "-99999px";
        hiddenRoot.style.width = "1px";
        hiddenRoot.style.height = "1px";
        hiddenRoot.style.overflow = "hidden";
        document.body.appendChild(hiddenRoot);

        let instance = null;
        try {
          instance = factory({ root: hiddenRoot, themeController }) || {};
        } catch (err) {
          console.error(err);
        }

        requestAnimationFrame(() => {
          const heading = hiddenRoot.querySelector("h1");
          if (heading && heading.textContent) {
            state.moduleDisplayNames[mod.id] = heading.textContent.trim();
            console.log('[Preloader] Extracted display name for', mod.id, ':', state.moduleDisplayNames[mod.id]);
          }

          if (instance && typeof instance.destroy === "function") {
            try {
              instance.destroy();
            } catch (e) {
              // ignore destroy errors
            }
          }
          document.body.removeChild(hiddenRoot);
          state.preloadedModules.add(mod.id);

          if (window.requestIdleCallback) {
            requestIdleCallback(() => preloadNext(index + 1));
          } else {
            Promise.resolve().then(() => preloadNext(index + 1));
          }
        });
      });
    };

    script.onerror = () => {
      console.error("Failed to preload script:", scriptSrc);
      state.preloadedModules.add(mod.id);
      if (window.requestIdleCallback) {
        requestIdleCallback(() => preloadNext(index + 1));
      } else {
        Promise.resolve().then(() => preloadNext(index + 1));
      }
    };

    document.head.appendChild(script);
  }

  preloadNext(0);
}

/**
 * Get initial folder on page load
 */
export function getInitialFolder(tree) {
  return tree;
}