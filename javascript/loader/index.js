/**
 * Central Loader Registry
 * Provides unified access to all lazy-loaded libraries
 */

// MathJax loader
export { loadMathJax, typeset } from './mathjax-loader.js';

// FontAwesome loader + helpers
export { 
  loadFontAwesome,
  containsFontAwesomeIcons,
  elementContainsFontAwesome,
  loadIconsIfNeeded,
  getTypeIcon, 
  getIcon,
  renderWithIcons
} from './fontawesome-loader.js';

// Future loaders can be added here:
// export { loadChartJS } from './chartjs-loader.js';
// export { loadPrism } from './prism-loader.js';
