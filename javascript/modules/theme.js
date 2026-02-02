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
  'banner-light': null,
  'favicon-dark': null,
  'favicon-light': null
};

/**
 * Preload all theme images including favicons
 */
function preloadThemeImages() {
  const images = [
    { key: 'logo-dark', src: './assets/logo-dark.png' },
    { key: 'logo-light', src: './assets/logo-light.png' },
    { key: 'banner-dark', src: './assets/banner-dark.png' },
    { key: 'banner-light', src: './assets/banner-light.png' },
    { key: 'favicon-dark', src: './assets/favicon/favicon-dark.svg' },
    { key: 'favicon-light', src: './assets/favicon/favicon-light.svg' }
  ];

  images.forEach(({ key, src }) => {
    const img = new Image();
    img.src = src;
    imageCache[key] = img;
  });

  console.log('[Theme] Theme assets preloaded (logos, banners, favicons)');
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
 * Update favicon based on theme
 * @param {string} theme - 'dark' or 'light'
 */
function updateFavicon(theme) {
  console.log('[Theme] Updating favicon for theme:', theme);
  
  // Update SVG favicon (primary method for modern browsers)
  const svgIcons = document.querySelectorAll('link[rel="icon"][type="image/svg+xml"]');
  svgIcons.forEach(icon => {
    const href = icon.getAttribute('href');
    const isDarkIcon = href.includes('favicon-dark.svg');
    const isLightIcon = href.includes('favicon-light.svg');
    
    // Update the active icon's href to force browser refresh
    if ((theme === 'dark' && isDarkIcon) || (theme === 'light' && isLightIcon)) {
      const newHref = theme === 'dark' 
        ? './assets/favicon/favicon-dark.svg' 
        : './assets/favicon/favicon-light.svg';
      
      // Force refresh by temporarily removing and re-adding
      const tempHref = icon.href;
      icon.href = '';
      setTimeout(() => {
        icon.href = tempHref === newHref ? newHref + '?refresh=' + Date.now() : newHref;
      }, 0);
    }
  });
  
  // Update Apple Touch Icon for iOS devices
  const appleTouchIcons = document.querySelectorAll('link[rel="apple-touch-icon"]');
  appleTouchIcons.forEach(icon => {
    const mediaQuery = icon.getAttribute('media');
    if (
      (theme === 'dark' && mediaQuery?.includes('dark')) ||
      (theme === 'light' && mediaQuery?.includes('light'))
    ) {
      // iOS will automatically pick the right one based on media query
      // Force refresh if needed
      const currentHref = icon.href;
      icon.href = '';
      setTimeout(() => { icon.href = currentHref; }, 0);
    }
  });
  
  // Update Android/PWA icons
  const pngIcons = document.querySelectorAll('link[rel="icon"][type="image/png"]');
  pngIcons.forEach(icon => {
    const mediaQuery = icon.getAttribute('media');
    if (
      (theme === 'dark' && mediaQuery?.includes('dark')) ||
      (theme === 'light' && mediaQuery?.includes('light'))
    ) {
      // Android will pick the right one based on media query
      const currentHref = icon.href;
      icon.href = '';
      setTimeout(() => { icon.href = currentHref; }, 0);
    }
  });
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

  // Update landscape left bar logo WITH animation
  if (landscapeLogo) {
    // Step 1: Remove existing animation
    landscapeLogo.classList.remove('animate');
    
    // Step 2: Force reflow
    void landscapeLogo.offsetWidth;
    
    // Step 3: Temporarily disable animation
    landscapeLogo.style.animation = 'none';
    
    // Step 4: Switch source
    landscapeLogo.src = theme === 'dark' 
      ? './assets/logo-dark.png' 
      : './assets/logo-light.png';
    
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
  updateFavicon(next);

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
  // Preload all theme images immediately (including favicons)
  preloadThemeImages();

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
  updateFavicon(initialTheme);
}