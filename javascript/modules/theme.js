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
 * Preload all theme images
 */
function preloadThemeImages() {
  const images = [
    { key: 'logo-dark', src: './assets/logo-dark.png' },
    { key: 'logo-light', src: './assets/logo-light.png' },
    { key: 'banner-dark', src: './assets/banner-dark.png' },
    { key: 'banner-light', src: './assets/banner-light.png' }
  ];

  images.forEach(({ key, src }) => {
    const img = new Image();
    img.src = src;
    imageCache[key] = img;
  });

  console.log('[Theme] Theme assets preloaded');
}

/**
 * Set theme color in meta tag
 */
export function setThemeMetaColor(theme) {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) return;
  meta.setAttribute("content", theme === "dark" ? "#111827" : "#f3f4f6");
}

/**
 * Update logo and banner based on theme with smooth transition
 */
export function updateThemeAssets(theme) {
  const headerLogo = document.getElementById('headerLogo');
  const headerBanner = document.getElementById('headerBanner');
  
  if (headerLogo && headerBanner) {
    // Fade out
    headerLogo.style.opacity = '0';
    headerBanner.style.opacity = '0';
    
    // Wait for fade out, then switch images
    setTimeout(() => {
      headerLogo.src = theme === 'dark' 
        ? './assets/logo-dark.png' 
        : './assets/logo-light.png';
      
      headerBanner.src = theme === 'dark' 
        ? './assets/banner-dark.png' 
        : './assets/banner-light.png';
      
      // Fade back in
      requestAnimationFrame(() => {
        headerLogo.style.opacity = '1';
        headerBanner.style.opacity = '1';
      });
    }, 200); // Match CSS transition duration
  }
}

/**
 * Toggle between dark and light themes
 */
export function toggleTheme() {
  const current = dom.htmlEl.getAttribute("data-theme") || "dark";
  const next = current === "dark" ? "light" : "dark";
  dom.htmlEl.setAttribute("data-theme", next);
  dom.themeIcon.textContent = next === "dark" ? "☾" : "☼";
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
 */
export function initTheme() {
  // Preload all theme images immediately
  preloadThemeImages();

  dom.themeToggleBtn.addEventListener("click", toggleTheme);

  const initialTheme = dom.htmlEl.getAttribute("data-theme") || "dark";
  dom.themeIcon.textContent = initialTheme === "dark" ? "☾" : "☼";
  setThemeMetaColor(initialTheme);
  
  // Set initial images without transition
  const headerLogo = document.getElementById('headerLogo');
  const headerBanner = document.getElementById('headerBanner');
  if (headerLogo && headerBanner) {
    headerLogo.style.opacity = '1';
    headerBanner.style.opacity = '1';
  }
}
