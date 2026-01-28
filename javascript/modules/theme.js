/**
 * Theme management module
 * Handles dark/light theme toggling
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
 * Toggle between dark and light themes
 */
export function toggleTheme() {
  const current = dom.htmlEl.getAttribute("data-theme") || "dark";
  const next = current === "dark" ? "light" : "dark";
  dom.htmlEl.setAttribute("data-theme", next);
  dom.themeIcon.textContent = next === "dark" ? "☾" : "☼";
  setThemeMetaColor(next);

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
}