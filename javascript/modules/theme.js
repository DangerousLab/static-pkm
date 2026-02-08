/**
 * Theme management module
 * Handles dark/light theme toggling and asset switching with preloading
 * PRODUCTION FIX v2: Addresses hover-triggered HTTP requests
 */

import { dom, state, themeController } from '../core/state.js';

// Cache for preloaded images
const imageCache = {
  'logo-dark': null,
  'logo-light': null,
  'banner-dark': null,
  'banner-light': null
};

// Track if animation is in progress to debounce
let animationInProgress = false;

/**
 * Preload all theme images (logos and banners only)
 * Returns a Promise that resolves when all images are loaded
 */
function preloadThemeImages() {
  const images = [
    { key: 'logo-dark', src: './assets/logo-dark.png' },
    { key: 'logo-light', src: './assets/logo-light.png' },
    { key: 'banner-dark', src: './assets/banner-dark.png' },
    { key: 'banner-light', src: './assets/banner-light.png' }
  ];

  // Create promises for each image load
  const loadPromises = images.map(({ key, src }) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        imageCache[key] = img;
        console.log(`[Theme] Preloaded ${key}`);
        resolve();
      };
      img.onerror = () => {
        console.warn(`[Theme] Failed to preload ${key}`);
        imageCache[key] = img; // Store anyway, fallback to string path
        resolve(); // Don't block on error
      };
      img.src = src;
    });
  });

  return Promise.all(loadPromises).then(() => {
    console.log('[Theme] All theme assets preloaded and ready');
  });
}

/**
 * Set theme color in meta tag
 */
export function setThemeMetaColor(theme) {
  const themeColorMeta = document.getElementById('theme-color-meta');

  if (themeColorMeta) {
    themeColorMeta.setAttribute("content", theme === "dark" ? "#1f1f1f" : "#f3f4f6");
  }
}

/**
 * Replace image element with cached version (NO HTTP request)
 * ENHANCED: Additional safeguards for production stability
 * @param {HTMLImageElement} targetImg - The img element to replace
 * @param {string} cacheKey - Key in imageCache
 * @param {string} fallbackSrc - Fallback URL if cache fails
 */
function replaceWithCachedImage(targetImg, cacheKey, fallbackSrc) {
  const cachedImg = imageCache[cacheKey];

  if (cachedImg && cachedImg.complete && cachedImg.naturalWidth > 0) {
    // Check if src is already correct (avoid unnecessary DOM operations)
    if (targetImg.src === cachedImg.src) {
      console.log(`[Theme] ${targetImg.id} already using correct cached image, skipping replace`);
      return targetImg;
    }

    // Clone the cached image to get a fresh DOM element
    const newImg = cachedImg.cloneNode(false);

    // Copy all attributes from target (except src which is already correct)
    Array.from(targetImg.attributes).forEach(attr => {
      if (attr.name !== 'src') {
        newImg.setAttribute(attr.name, attr.value);
      }
    });

    // Copy computed classes
    newImg.className = targetImg.className;

    // PRODUCTION FIX: Block all interactions to prevent hover prefetching
    newImg.style.pointerEvents = 'none';
    newImg.style.userSelect = 'none';

    // Replace in DOM (this uses the cached bitmap, NO HTTP request)
    targetImg.parentNode.replaceChild(newImg, targetImg);

    console.log(`[Theme] Replaced ${targetImg.id} with cached image (0 HTTP requests)`);
    return newImg;
  } else {
    // Fallback: set src directly (will trigger HTTP request)
    console.warn(`[Theme] Cache miss for ${cacheKey}, using fallback (HTTP request)`);
    targetImg.src = fallbackSrc;
    return targetImg;
  }
}

/**
 * Clean up animation state after completion
 * Removes will-change to free GPU resources
 */
function cleanupAnimation(element) {
  if (!element) return;

  // Remove will-change after animation completes
  element.addEventListener('animationend', function handler() {
    element.style.willChange = 'auto';
    element.removeEventListener('animationend', handler);
  }, { once: true });
}

/**
 * Update logo and banner based on theme with slide-up animation
 */
export function updateThemeAssets(theme) {
  // Debounce: prevent rapid successive calls during hover
  if (animationInProgress) {
    console.log('[Theme] Animation in progress, skipping update');
    return;
  }

  animationInProgress = true;

  let headerLogo = document.getElementById('headerLogo');
  let headerBanner = document.getElementById('headerBanner');
  const headerTagline = document.querySelector('.header-tagline');
  let landscapeLogo = document.getElementById('landscapeLogo');

  if (headerLogo && headerBanner) {
    // Step 1: Remove existing animations by removing class
    headerLogo.classList.remove('animate');
    headerBanner.classList.remove('animate');
    if (headerTagline) {
      headerTagline.classList.remove('animate');
    }

    // Step 2: Force reflow to ensure animation can restart
    void headerLogo.offsetWidth;
    void headerBanner.offsetWidth;
    if (headerTagline) {
      void headerTagline.offsetWidth;
    }

    // Step 3: Temporarily disable animation on elements
    headerLogo.style.animation = 'none';
    headerBanner.style.animation = 'none';
    if (headerTagline) {
      headerTagline.style.animation = 'none';
    }

    // Step 4: Replace with cached images (ZERO HTTP requests)
    const logoKey = theme === 'dark' ? 'logo-dark' : 'logo-light';
    const bannerKey = theme === 'dark' ? 'banner-dark' : 'banner-light';
    const logoFallback = theme === 'dark' ? './assets/logo-dark.png' : './assets/logo-light.png';
    const bannerFallback = theme === 'dark' ? './assets/banner-dark.png' : './assets/banner-light.png';

    // Replace elements (updates references since new elements are created)
    headerLogo = replaceWithCachedImage(headerLogo, logoKey, logoFallback);
    headerBanner = replaceWithCachedImage(headerBanner, bannerKey, bannerFallback);

    // Step 5: Re-enable animation and add animate class in next frame
    requestAnimationFrame(() => {
      // Remove inline style to restore CSS animation
      headerLogo.style.animation = '';
      headerBanner.style.animation = '';
      if (headerTagline) {
        headerTagline.style.animation = '';
      }

      // Add animate class to trigger animation
      requestAnimationFrame(() => {
        headerLogo.classList.add('animate');
        headerBanner.classList.add('animate');
        if (headerTagline) {
          headerTagline.classList.add('animate');
        }

        // Clean up GPU resources after animation
        cleanupAnimation(headerLogo);
        cleanupAnimation(headerBanner);
        if (headerTagline) {
          cleanupAnimation(headerTagline);
        }

        // Reset debounce flag after animation starts
        setTimeout(() => {
          animationInProgress = false;
        }, 50);
      });
    });
  }

  // Update landscape left bar logo WITH animation
  if (landscapeLogo) {
    // Step 1: Remove existing animation
    landscapeLogo.classList.remove('animate');

    // Step 2: Force reflow
    void landscapeLogo.offsetWidth;

    // Step 3: Temporarily disable animation
    landscapeLogo.style.animation = 'none';

    // Step 4: Replace with cached image (ZERO HTTP requests)
    const logoKey = theme === 'dark' ? 'logo-dark' : 'logo-light';
    const logoFallback = theme === 'dark' ? './assets/logo-dark.png' : './assets/logo-light.png';

    landscapeLogo = replaceWithCachedImage(landscapeLogo, logoKey, logoFallback);

    // Step 5: Re-enable animation
    requestAnimationFrame(() => {
      landscapeLogo.style.animation = '';
      requestAnimationFrame(() => {
        landscapeLogo.classList.add('animate');
        cleanupAnimation(landscapeLogo);
      });
    });
  }
}

/**
 * Toggle between dark and light themes
 */
export function toggleTheme() {
  const current = dom.htmlEl.getAttribute("data-theme") || "dark";
  const next = current === "dark" ? "light" : "dark";
  dom.htmlEl.setAttribute("data-theme", next);

  // Update main theme icon
  dom.themeIcon.textContent = next === "dark" ? "☾" : "☼";

  // Update landscape theme icon
  const landscapeThemeIcon = document.getElementById('landscapeThemeIcon');
  if (landscapeThemeIcon) {
    landscapeThemeIcon.textContent = next === "dark" ? "☾" : "☼";
  }

  setThemeMetaColor(next);
  updateThemeAssets(next);

  const event = new CustomEvent("themechange", { detail: { theme: next } });
  document.dispatchEvent(event);

  if (state.activeInstance && typeof state.activeInstance.onThemeChange === "function") {
    requestAnimationFrame(() => {
      if (state.activeInstance && typeof state.activeInstance.onThemeChange === "function") {
        state.activeInstance.onThemeChange(next);
      }
    });
  }
}

/**
 * Initialize theme system
 * Returns a Promise that resolves when theme is fully initialized
 */
export async function initTheme() {
  // Preload all theme images and wait for completion
  await preloadThemeImages();

  // Main theme toggle
  dom.themeToggleBtn.addEventListener("click", toggleTheme);

  // Landscape left bar theme toggle
  const landscapeThemeToggle = document.getElementById('landscapeThemeToggle');
  if (landscapeThemeToggle) {
    landscapeThemeToggle.addEventListener("click", toggleTheme);
  }

  const initialTheme = dom.htmlEl.getAttribute("data-theme") || "dark";
  dom.themeIcon.textContent = initialTheme === "dark" ? "☾" : "☼";

  // Set initial landscape theme icon
  const landscapeThemeIcon = document.getElementById('landscapeThemeIcon');
  if (landscapeThemeIcon) {
    landscapeThemeIcon.textContent = initialTheme === "dark" ? "☾" : "☼";
  }

  setThemeMetaColor(initialTheme);
}
