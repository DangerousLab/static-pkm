/**
 * Theme management module
 * Handles dark/light theme toggling and asset switching
 */

import { dom, state, themeController } from '../core/state.js';

/**
 * Set theme color in meta tag
 */
export function setThemeMetaColor(theme) {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) return;
  meta.setAttribute("content", theme === "dark" ? "#111827" : "#f3f4f6");
}

/**
 * Update logo and banner based on theme
 */
export function updateThemeAssets(theme) {
  const headerLogo = document.getElementById('headerLogo');
  const headerBanner = document.getElementById('headerBanner');
  
  if (headerLogo) {
    headerLogo.src = theme === 'dark' 
      ? './assets/logo-dark.png' 
      : './assets/logo-light.png';
  }
  
  if (headerBanner) {
    headerBanner.src = theme === 'dark' 
      ? './assets/banner-dark.png' 
      : './assets/banner-light.png';
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
  dom.themeToggleBtn.addEventListener("click", toggleTheme);

  const initialTheme = dom.htmlEl.getAttribute("data-theme") || "dark";
  dom.themeIcon.textContent = initialTheme === "dark" ? "☾" : "☼";
  setThemeMetaColor(initialTheme);
  updateThemeAssets(initialTheme);
}