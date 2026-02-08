/**
 * Central Loader Registry
 * Provides unified access to all lazy-loaded libraries
 */

export { loadMathJax, typeset } from './mathjax-loader.js';
export { 
  loadFontAwesome, 
  containsFontAwesomeIcons, 
  elementContainsFontAwesome, 
  loadIconsIfNeeded 
} from './fontawesome-loader.js';

// Future loaders can be added here:
// export { loadChartJS } from './chartjs-loader.js';
// export { loadPrism } from './prism-loader.js';