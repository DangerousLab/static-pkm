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
 * Update logo and banner based on theme with slide-up animation
 */
export function updateThemeAssets(theme) {
  const headerLogo = document.getElementById('headerLogo');
  const headerBanner = document.getElementById('headerBanner');
  const headerTagline = document.querySelector('.header-tagline');
  
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
    
    // Step 4: Switch source immediately
    headerLogo.src = theme === 'dark' 
      ? './assets/logo-dark.png' 
      : './assets/logo-light.png';
    
    headerBanner.src = theme === 'dark' 
      ? './assets/banner-dark.png' 
      : './assets/banner-light.png';
    
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
  
  // Initial load already has animation via CSS
  // No need to do anything special
}