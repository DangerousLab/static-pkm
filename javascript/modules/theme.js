/**
 * Theme management module
 * Handles dark/light theme toggling and asset switching with preloading
 */

import { dom, state, themeController } from '../core/state.js';

// Cache for preloaded images
const imageCache = {
  'logo-dark': null,
  'logo-light': null,
  'banner-dark': null,
  'banner-light': null
};

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
 * Update logo and banner based on theme with slide-up animation
 */
export function updateThemeAssets(theme) {
  const headerLogo = document.getElementById('headerLogo');
  const headerBanner = document.getElementById('headerBanner');
  const headerTagline = document.querySelector('.header-tagline');
  const landscapeLogo = document.getElementById('landscapeLogo');

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

    // Step 4: Switch source using consistent URL paths
    // CRITICAL FIX: Use direct paths to leverage browser cache
    // Preloading ensures these are already in browser memory/disk cache
    const logoPath = theme === 'dark' ? './assets/logo-dark.png' : './assets/logo-light.png';
    const bannerPath = theme === 'dark' ? './assets/banner-dark.png' : './assets/banner-light.png';

    // Setting the exact same src forces browser to use memory cache
    headerLogo.src = logoPath;
    headerBanner.src = bannerPath;

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

    // Step 4: Switch source using consistent URL path
    // CRITICAL FIX: Use direct path to leverage browser cache
    const logoPath = theme === 'dark' ? './assets/logo-dark.png' : './assets/logo-light.png';
    landscapeLogo.src = logoPath;

    // Step 5: Re-enable animation
    requestAnimationFrame(() => {
      landscapeLogo.style.animation = '';
      requestAnimationFrame(() => {
        landscapeLogo.classList.add('animate');
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
    setTimeout(() => state.activeInstance.onThemeChange(next), 50);
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
