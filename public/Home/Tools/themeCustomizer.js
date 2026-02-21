// themeCustomizer.js v1.0 - Theme CSS variable customizer with comprehensive presets
(function () {
  'use strict';

  function createThemeCustomizer(options) {
    const { container, themeController } = options;

    console.log('[ThemeCustomizer] Initializing v1.0');

    // ==================== VARIABLE DEFINITIONS ====================
    const VARIABLE_CATEGORIES = {
      backgrounds: ['--bg', '--bg-card', '--bg-panel', '--bg-deep', '--bg-panel-focus', '--bg-hover', '--bg-disabled', '--bg-highlight', '--bg-overlay'],
      text: ['--text-main', '--text-muted'],
      accents: ['--accent', '--accent-soft', '--accent-gold', '--danger', '--success'],
      borders: ['--border-subtle', '--border-medium', '--border-light', '--border-strong', '--border-section', '--border-divider']
    };

    // Variables that support alpha transparency
    const ALPHA_VARIABLES = [
      '--bg-hover', '--bg-disabled', '--bg-highlight', '--bg-overlay',
      '--accent-soft', '--border-subtle', '--border-medium',
      '--border-light', '--border-strong', '--border-section', '--border-divider'
    ];

    // Default values captured at runtime from color-scheme.css (not hardcoded)
    const DEFAULT_VALUES = { dark: null, light: null };

    function captureCurrentDefaults() {
      const computedStyle = getComputedStyle(document.documentElement);
      const allVars = Object.values(VARIABLE_CATEGORIES).flat();
      const defaults = {};
      allVars.forEach(varName => {
        defaults[varName] = computedStyle.getPropertyValue(varName).trim();
      });
      return defaults;
    }

    // ==================== COMPREHENSIVE THEME PRESETS ====================
    const THEME_PRESETS = {
      // ========== DARK THEMES (11 total) ==========
      'default-dark': {
        name: 'Default Dark',
        category: 'dark',
        colors: {
          '--bg': '#3c3c3c',
          '--bg-card': '#303030',
          '--bg-panel': '#262626',
          '--bg-deep': '#1f1f1f',
          '--bg-panel-focus': '#2c2c2c',
          '--bg-hover': 'rgba(80, 80, 80, 0.35)',
          '--bg-disabled': 'rgba(128, 128, 128, 0.2)',
          '--bg-highlight': 'rgba(224, 160, 31, 0.25)',
          '--bg-overlay': 'rgba(0, 0, 0, 0.5)',
          '--text-main': '#f5f5f5',
          '--text-muted': '#c4c4c4',
          '--accent': '#e5e5e5',
          '--accent-soft': 'rgba(229, 229, 229, 0.08)',
          '--accent-gold': 'rgb(224, 160, 31)',
          '--danger': '#ff4b4b',
          '--success': '#4ade80',
          '--border-subtle': 'rgba(120, 120, 120, 0.7)',
          '--border-medium': 'rgba(148, 148, 148, 0.6)',
          '--border-light': 'rgba(180, 180, 180, 0.5)',
          '--border-strong': 'rgba(160, 160, 160, 0.55)',
          '--border-section': 'rgba(148, 148, 148, 0.3)',
          '--border-divider': 'rgba(148, 148, 148, 0.2)'
        }
      },
      'obsidian': {
        name: 'Obsidian',
        category: 'dark',
        colors: {
          '--bg': '#1e1e1e',
          '--bg-card': '#252525',
          '--bg-panel': '#1a1a1a',
          '--bg-deep': '#111111',
          '--bg-panel-focus': '#202020',
          '--bg-hover': 'rgba(127, 109, 242, 0.15)',
          '--bg-disabled': 'rgba(100, 100, 100, 0.2)',
          '--bg-highlight': 'rgba(127, 109, 242, 0.25)',
          '--bg-overlay': 'rgba(0, 0, 0, 0.5)',
          '--text-main': '#dcddde',
          '--text-muted': '#999999',
          '--accent': '#7f6df2',
          '--accent-soft': 'rgba(127, 109, 242, 0.08)',
          '--accent-gold': 'rgb(179, 146, 255)',
          '--danger': '#e74c3c',
          '--success': '#50fa7b',
          '--border-subtle': 'rgba(80, 80, 80, 0.7)',
          '--border-medium': 'rgba(100, 100, 100, 0.6)',
          '--border-light': 'rgba(120, 120, 120, 0.5)',
          '--border-strong': 'rgba(140, 140, 140, 0.55)',
          '--border-section': 'rgba(100, 100, 100, 0.3)',
          '--border-divider': 'rgba(100, 100, 100, 0.2)'
        }
      },
      'nord-dark': {
        name: 'Nord Dark',
        category: 'dark',
        colors: {
          '--bg': '#2e3440',
          '--bg-card': '#3b4252',
          '--bg-panel': '#242933',
          '--bg-deep': '#1c2028',
          '--bg-panel-focus': '#2a303e',
          '--bg-hover': 'rgba(136, 192, 208, 0.15)',
          '--bg-disabled': 'rgba(76, 86, 106, 0.3)',
          '--bg-highlight': 'rgba(136, 192, 208, 0.25)',
          '--bg-overlay': 'rgba(0, 0, 0, 0.5)',
          '--text-main': '#eceff4',
          '--text-muted': '#81a1c1',
          '--accent': '#88c0d0',
          '--accent-soft': 'rgba(136, 192, 208, 0.08)',
          '--accent-gold': 'rgb(235, 203, 139)',
          '--danger': '#bf616a',
          '--success': '#a3be8c',
          '--border-subtle': 'rgba(76, 86, 106, 0.7)',
          '--border-medium': 'rgba(76, 86, 106, 0.6)',
          '--border-light': 'rgba(76, 86, 106, 0.5)',
          '--border-strong': 'rgba(76, 86, 106, 0.8)',
          '--border-section': 'rgba(76, 86, 106, 0.3)',
          '--border-divider': 'rgba(76, 86, 106, 0.2)'
        }
      },
      'dracula': {
        name: 'Dracula',
        category: 'dark',
        colors: {
          '--bg': '#282a36',
          '--bg-card': '#343746',
          '--bg-panel': '#21222c',
          '--bg-deep': '#191a21',
          '--bg-panel-focus': '#26272f',
          '--bg-hover': 'rgba(189, 147, 249, 0.15)',
          '--bg-disabled': 'rgba(68, 71, 90, 0.3)',
          '--bg-highlight': 'rgba(189, 147, 249, 0.25)',
          '--bg-overlay': 'rgba(0, 0, 0, 0.5)',
          '--text-main': '#f8f8f2',
          '--text-muted': '#6272a4',
          '--accent': '#bd93f9',
          '--accent-soft': 'rgba(189, 147, 249, 0.08)',
          '--accent-gold': 'rgb(241, 250, 140)',
          '--danger': '#ff5555',
          '--success': '#50fa7b',
          '--border-subtle': 'rgba(68, 71, 90, 0.7)',
          '--border-medium': 'rgba(68, 71, 90, 0.6)',
          '--border-light': 'rgba(68, 71, 90, 0.5)',
          '--border-strong': 'rgba(68, 71, 90, 0.8)',
          '--border-section': 'rgba(68, 71, 90, 0.3)',
          '--border-divider': 'rgba(68, 71, 90, 0.2)'
        }
      },
      'monokai': {
        name: 'Monokai',
        category: 'dark',
        colors: {
          '--bg': '#272822',
          '--bg-card': '#3e3d32',
          '--bg-panel': '#1e1f1c',
          '--bg-deep': '#161714',
          '--bg-panel-focus': '#232420',
          '--bg-hover': 'rgba(230, 219, 116, 0.15)',
          '--bg-disabled': 'rgba(117, 113, 94, 0.3)',
          '--bg-highlight': 'rgba(230, 219, 116, 0.25)',
          '--bg-overlay': 'rgba(0, 0, 0, 0.5)',
          '--text-main': '#f8f8f2',
          '--text-muted': '#75715e',
          '--accent': '#e6db74',
          '--accent-soft': 'rgba(230, 219, 116, 0.08)',
          '--accent-gold': 'rgb(253, 151, 31)',
          '--danger': '#f92672',
          '--success': '#a6e22e',
          '--border-subtle': 'rgba(117, 113, 94, 0.7)',
          '--border-medium': 'rgba(117, 113, 94, 0.6)',
          '--border-light': 'rgba(117, 113, 94, 0.5)',
          '--border-strong': 'rgba(117, 113, 94, 0.8)',
          '--border-section': 'rgba(117, 113, 94, 0.3)',
          '--border-divider': 'rgba(117, 113, 94, 0.2)'
        }
      },
      'tokyo-night': {
        name: 'Tokyo Night',
        category: 'dark',
        colors: {
          '--bg': '#1a1b26',
          '--bg-card': '#24283b',
          '--bg-panel': '#16161e',
          '--bg-deep': '#0f0f17',
          '--bg-panel-focus': '#1a1a24',
          '--bg-hover': 'rgba(122, 162, 247, 0.15)',
          '--bg-disabled': 'rgba(41, 46, 73, 0.3)',
          '--bg-highlight': 'rgba(122, 162, 247, 0.25)',
          '--bg-overlay': 'rgba(0, 0, 0, 0.5)',
          '--text-main': '#c0caf5',
          '--text-muted': '#565f89',
          '--accent': '#7aa2f7',
          '--accent-soft': 'rgba(122, 162, 247, 0.08)',
          '--accent-gold': 'rgb(224, 175, 104)',
          '--danger': '#f7768e',
          '--success': '#9ece6a',
          '--border-subtle': 'rgba(41, 46, 73, 0.7)',
          '--border-medium': 'rgba(41, 46, 73, 0.6)',
          '--border-light': 'rgba(41, 46, 73, 0.5)',
          '--border-strong': 'rgba(41, 46, 73, 0.8)',
          '--border-section': 'rgba(41, 46, 73, 0.3)',
          '--border-divider': 'rgba(41, 46, 73, 0.2)'
        }
      },
      'ayu-mirage': {
        name: 'Ayu Mirage',
        category: 'dark',
        colors: {
          '--bg': '#1f2430',
          '--bg-card': '#272d38',
          '--bg-panel': '#191e2a',
          '--bg-deep': '#121720',
          '--bg-panel-focus': '#1e2330',
          '--bg-hover': 'rgba(95, 191, 227, 0.15)',
          '--bg-disabled': 'rgba(52, 61, 75, 0.3)',
          '--bg-highlight': 'rgba(255, 204, 102, 0.25)',
          '--bg-overlay': 'rgba(0, 0, 0, 0.5)',
          '--text-main': '#cbccc6',
          '--text-muted': '#707a8c',
          '--accent': '#5fbfe3',
          '--accent-soft': 'rgba(95, 191, 227, 0.08)',
          '--accent-gold': 'rgb(255, 204, 102)',
          '--danger': '#f28779',
          '--success': '#bae67e',
          '--border-subtle': 'rgba(52, 61, 75, 0.7)',
          '--border-medium': 'rgba(52, 61, 75, 0.6)',
          '--border-light': 'rgba(52, 61, 75, 0.5)',
          '--border-strong': 'rgba(52, 61, 75, 0.8)',
          '--border-section': 'rgba(52, 61, 75, 0.3)',
          '--border-divider': 'rgba(52, 61, 75, 0.2)'
        }
      },
      'one-dark': {
        name: 'One Dark',
        category: 'dark',
        colors: {
          '--bg': '#282c34',
          '--bg-card': '#2c313a',
          '--bg-panel': '#21252b',
          '--bg-deep': '#181b21',
          '--bg-panel-focus': '#262a31',
          '--bg-hover': 'rgba(97, 175, 239, 0.15)',
          '--bg-disabled': 'rgba(60, 66, 77, 0.3)',
          '--bg-highlight': 'rgba(209, 154, 102, 0.25)',
          '--bg-overlay': 'rgba(0, 0, 0, 0.5)',
          '--text-main': '#abb2bf',
          '--text-muted': '#5c6370',
          '--accent': '#61afef',
          '--accent-soft': 'rgba(97, 175, 239, 0.08)',
          '--accent-gold': 'rgb(209, 154, 102)',
          '--danger': '#e06c75',
          '--success': '#98c379',
          '--border-subtle': 'rgba(60, 66, 77, 0.7)',
          '--border-medium': 'rgba(60, 66, 77, 0.6)',
          '--border-light': 'rgba(60, 66, 77, 0.5)',
          '--border-strong': 'rgba(60, 66, 77, 0.8)',
          '--border-section': 'rgba(60, 66, 77, 0.3)',
          '--border-divider': 'rgba(60, 66, 77, 0.2)'
        }
      },
      'material-dark': {
        name: 'Material Dark',
        category: 'dark',
        colors: {
          '--bg': '#263238',
          '--bg-card': '#2e3c43',
          '--bg-panel': '#1e272c',
          '--bg-deep': '#161f23',
          '--bg-panel-focus': '#232d32',
          '--bg-hover': 'rgba(128, 203, 196, 0.15)',
          '--bg-disabled': 'rgba(55, 71, 79, 0.3)',
          '--bg-highlight': 'rgba(255, 203, 107, 0.25)',
          '--bg-overlay': 'rgba(0, 0, 0, 0.5)',
          '--text-main': '#eeffff',
          '--text-muted': '#546e7a',
          '--accent': '#80cbc4',
          '--accent-soft': 'rgba(128, 203, 196, 0.08)',
          '--accent-gold': 'rgb(255, 203, 107)',
          '--danger': '#f07178',
          '--success': '#c3e88d',
          '--border-subtle': 'rgba(55, 71, 79, 0.7)',
          '--border-medium': 'rgba(55, 71, 79, 0.6)',
          '--border-light': 'rgba(55, 71, 79, 0.5)',
          '--border-strong': 'rgba(55, 71, 79, 0.8)',
          '--border-section': 'rgba(55, 71, 79, 0.3)',
          '--border-divider': 'rgba(55, 71, 79, 0.2)'
        }
      },
      'gruvbox-dark': {
        name: 'Gruvbox Dark',
        category: 'dark',
        colors: {
          '--bg': '#282828',
          '--bg-card': '#3c3836',
          '--bg-panel': '#1d2021',
          '--bg-deep': '#141617',
          '--bg-panel-focus': '#212526',
          '--bg-hover': 'rgba(251, 184, 108, 0.15)',
          '--bg-disabled': 'rgba(80, 73, 69, 0.3)',
          '--bg-highlight': 'rgba(250, 189, 47, 0.25)',
          '--bg-overlay': 'rgba(0, 0, 0, 0.5)',
          '--text-main': '#ebdbb2',
          '--text-muted': '#a89984',
          '--accent': '#fbb86c',
          '--accent-soft': 'rgba(251, 184, 108, 0.08)',
          '--accent-gold': 'rgb(250, 189, 47)',
          '--danger': '#fb4934',
          '--success': '#b8bb26',
          '--border-subtle': 'rgba(80, 73, 69, 0.7)',
          '--border-medium': 'rgba(80, 73, 69, 0.6)',
          '--border-light': 'rgba(80, 73, 69, 0.5)',
          '--border-strong': 'rgba(80, 73, 69, 0.8)',
          '--border-section': 'rgba(80, 73, 69, 0.3)',
          '--border-divider': 'rgba(80, 73, 69, 0.2)'
        }
      },
      'palenight': {
        name: 'Palenight',
        category: 'dark',
        colors: {
          '--bg': '#292d3e',
          '--bg-card': '#34324a',
          '--bg-panel': '#1e2030',
          '--bg-deep': '#161826',
          '--bg-panel-focus': '#222436',
          '--bg-hover': 'rgba(130, 170, 255, 0.15)',
          '--bg-disabled': 'rgba(52, 50, 74, 0.3)',
          '--bg-highlight': 'rgba(255, 203, 107, 0.25)',
          '--bg-overlay': 'rgba(0, 0, 0, 0.5)',
          '--text-main': '#bfc7d5',
          '--text-muted': '#676e95',
          '--accent': '#82aaff',
          '--accent-soft': 'rgba(130, 170, 255, 0.08)',
          '--accent-gold': 'rgb(255, 203, 107)',
          '--danger': '#f07178',
          '--success': '#c3e88d',
          '--border-subtle': 'rgba(52, 50, 74, 0.7)',
          '--border-medium': 'rgba(52, 50, 74, 0.6)',
          '--border-light': 'rgba(52, 50, 74, 0.5)',
          '--border-strong': 'rgba(52, 50, 74, 0.8)',
          '--border-section': 'rgba(52, 50, 74, 0.3)',
          '--border-divider': 'rgba(52, 50, 74, 0.2)'
        }
      },

      // ========== LIGHT THEMES (8 total) ==========
      'default-light': {
        name: 'Default Light',
        category: 'light',
        colors: {
          '--bg': '#f3f4f6',
          '--bg-card': '#ffffff',
          '--bg-panel': '#f9fafb',
          '--bg-deep': '#f3f4f6',
          '--bg-panel-focus': '#f9fafb',
          '--bg-hover': 'rgba(148, 163, 184, 0.25)',
          '--bg-disabled': 'rgba(148, 163, 184, 0.15)',
          '--bg-highlight': 'rgba(224, 160, 31, 0.2)',
          '--bg-overlay': 'rgba(0, 0, 0, 0.3)',
          '--text-main': '#111111',
          '--text-muted': '#6b7280',
          '--accent': '#111111',
          '--accent-soft': 'rgba(17, 17, 17, 0.04)',
          '--accent-gold': 'rgb(224, 160, 31)',
          '--danger': '#dc2626',
          '--success': '#16a34a',
          '--border-subtle': 'rgba(148, 163, 184, 0.7)',
          '--border-medium': 'rgba(148, 163, 184, 0.6)',
          '--border-light': 'rgba(148, 163, 184, 0.5)',
          '--border-strong': 'rgba(148, 163, 184, 0.7)',
          '--border-section': 'rgba(148, 163, 184, 0.3)',
          '--border-divider': 'rgba(148, 163, 184, 0.2)'
        }
      },
      'sepia': {
        name: 'Sepia',
        category: 'light',
        colors: {
          '--bg': '#f4ecd8',
          '--bg-card': '#faf6ed',
          '--bg-panel': '#ebe3d2',
          '--bg-deep': '#e4d9c2',
          '--bg-panel-focus': '#efe8d9',
          '--bg-hover': 'rgba(139, 105, 20, 0.15)',
          '--bg-disabled': 'rgba(139, 105, 20, 0.1)',
          '--bg-highlight': 'rgba(139, 105, 20, 0.2)',
          '--bg-overlay': 'rgba(0, 0, 0, 0.3)',
          '--text-main': '#3b3528',
          '--text-muted': '#6b5d48',
          '--accent': '#8b6914',
          '--accent-soft': 'rgba(139, 105, 20, 0.06)',
          '--accent-gold': 'rgb(184, 134, 11)',
          '--danger': '#a0522d',
          '--success': '#6b8e23',
          '--border-subtle': 'rgba(139, 105, 20, 0.3)',
          '--border-medium': 'rgba(139, 105, 20, 0.25)',
          '--border-light': 'rgba(139, 105, 20, 0.2)',
          '--border-strong': 'rgba(139, 105, 20, 0.4)',
          '--border-section': 'rgba(139, 105, 20, 0.15)',
          '--border-divider': 'rgba(139, 105, 20, 0.1)'
        }
      },
      'nord-light': {
        name: 'Nord Light',
        category: 'light',
        colors: {
          '--bg': '#eceff4',
          '--bg-card': '#ffffff',
          '--bg-panel': '#e5e9f0',
          '--bg-deep': '#dde3ec',
          '--bg-panel-focus': '#eaedf3',
          '--bg-hover': 'rgba(94, 129, 172, 0.15)',
          '--bg-disabled': 'rgba(94, 129, 172, 0.1)',
          '--bg-highlight': 'rgba(136, 192, 208, 0.25)',
          '--bg-overlay': 'rgba(0, 0, 0, 0.3)',
          '--text-main': '#2e3440',
          '--text-muted': '#4c566a',
          '--accent': '#5e81ac',
          '--accent-soft': 'rgba(94, 129, 172, 0.06)',
          '--accent-gold': 'rgb(235, 203, 139)',
          '--danger': '#bf616a',
          '--success': '#a3be8c',
          '--border-subtle': 'rgba(94, 129, 172, 0.3)',
          '--border-medium': 'rgba(94, 129, 172, 0.25)',
          '--border-light': 'rgba(94, 129, 172, 0.2)',
          '--border-strong': 'rgba(94, 129, 172, 0.4)',
          '--border-section': 'rgba(94, 129, 172, 0.15)',
          '--border-divider': 'rgba(94, 129, 172, 0.1)'
        }
      },
      'solarized-light': {
        name: 'Solarized Light',
        category: 'light',
        colors: {
          '--bg': '#fdf6e3',
          '--bg-card': '#eee8d5',
          '--bg-panel': '#f7f0dc',
          '--bg-deep': '#ede7d1',
          '--bg-panel-focus': '#faf4e3',
          '--bg-hover': 'rgba(38, 139, 210, 0.15)',
          '--bg-disabled': 'rgba(147, 161, 161, 0.15)',
          '--bg-highlight': 'rgba(181, 137, 0, 0.2)',
          '--bg-overlay': 'rgba(0, 0, 0, 0.3)',
          '--text-main': '#657b83',
          '--text-muted': '#93a1a1',
          '--accent': '#268bd2',
          '--accent-soft': 'rgba(38, 139, 210, 0.06)',
          '--accent-gold': 'rgb(181, 137, 0)',
          '--danger': '#dc322f',
          '--success': '#859900',
          '--border-subtle': 'rgba(147, 161, 161, 0.3)',
          '--border-medium': 'rgba(147, 161, 161, 0.25)',
          '--border-light': 'rgba(147, 161, 161, 0.2)',
          '--border-strong': 'rgba(147, 161, 161, 0.4)',
          '--border-section': 'rgba(147, 161, 161, 0.15)',
          '--border-divider': 'rgba(147, 161, 161, 0.1)'
        }
      },
      'ayu-light': {
        name: 'Ayu Light',
        category: 'light',
        colors: {
          '--bg': '#fafafa',
          '--bg-card': '#ffffff',
          '--bg-panel': '#f3f4f5',
          '--bg-deep': '#eaebec',
          '--bg-panel-focus': '#f7f8f9',
          '--bg-hover': 'rgba(85, 181, 219, 0.15)',
          '--bg-disabled': 'rgba(130, 146, 162, 0.15)',
          '--bg-highlight': 'rgba(255, 153, 0, 0.2)',
          '--bg-overlay': 'rgba(0, 0, 0, 0.3)',
          '--text-main': '#5c6166',
          '--text-muted': '#828c99',
          '--accent': '#55b5db',
          '--accent-soft': 'rgba(85, 181, 219, 0.06)',
          '--accent-gold': 'rgb(255, 153, 0)',
          '--danger': '#f07171',
          '--success': '#86b300',
          '--border-subtle': 'rgba(130, 146, 162, 0.3)',
          '--border-medium': 'rgba(130, 146, 162, 0.25)',
          '--border-light': 'rgba(130, 146, 162, 0.2)',
          '--border-strong': 'rgba(130, 146, 162, 0.4)',
          '--border-section': 'rgba(130, 146, 162, 0.15)',
          '--border-divider': 'rgba(130, 146, 162, 0.1)'
        }
      },
      'github-light': {
        name: 'GitHub Light',
        category: 'light',
        colors: {
          '--bg': '#ffffff',
          '--bg-card': '#f6f8fa',
          '--bg-panel': '#ffffff',
          '--bg-deep': '#f6f8fa',
          '--bg-panel-focus': '#f9fafb',
          '--bg-hover': 'rgba(33, 136, 255, 0.15)',
          '--bg-disabled': 'rgba(208, 215, 222, 0.3)',
          '--bg-highlight': 'rgba(255, 184, 0, 0.2)',
          '--bg-overlay': 'rgba(0, 0, 0, 0.3)',
          '--text-main': '#24292f',
          '--text-muted': '#57606a',
          '--accent': '#0969da',
          '--accent-soft': 'rgba(9, 105, 218, 0.06)',
          '--accent-gold': 'rgb(255, 184, 0)',
          '--danger': '#cf222e',
          '--success': '#1a7f37',
          '--border-subtle': 'rgba(208, 215, 222, 0.4)',
          '--border-medium': 'rgba(208, 215, 222, 0.35)',
          '--border-light': 'rgba(208, 215, 222, 0.3)',
          '--border-strong': 'rgba(208, 215, 222, 0.5)',
          '--border-section': 'rgba(208, 215, 222, 0.2)',
          '--border-divider': 'rgba(208, 215, 222, 0.15)'
        }
      },
      'one-light': {
        name: 'One Light',
        category: 'light',
        colors: {
          '--bg': '#fafafa',
          '--bg-card': '#ffffff',
          '--bg-panel': '#f0f0f0',
          '--bg-deep': '#e8e8e8',
          '--bg-panel-focus': '#f5f5f5',
          '--bg-hover': 'rgba(64, 120, 242, 0.15)',
          '--bg-disabled': 'rgba(160, 161, 167, 0.15)',
          '--bg-highlight': 'rgba(193, 132, 1, 0.2)',
          '--bg-overlay': 'rgba(0, 0, 0, 0.3)',
          '--text-main': '#383a42',
          '--text-muted': '#a0a1a7',
          '--accent': '#4078f2',
          '--accent-soft': 'rgba(64, 120, 242, 0.06)',
          '--accent-gold': 'rgb(193, 132, 1)',
          '--danger': '#e45649',
          '--success': '#50a14f',
          '--border-subtle': 'rgba(160, 161, 167, 0.3)',
          '--border-medium': 'rgba(160, 161, 167, 0.25)',
          '--border-light': 'rgba(160, 161, 167, 0.2)',
          '--border-strong': 'rgba(160, 161, 167, 0.4)',
          '--border-section': 'rgba(160, 161, 167, 0.15)',
          '--border-divider': 'rgba(160, 161, 167, 0.1)'
        }
      },
      'material-light': {
        name: 'Material Light',
        category: 'light',
        colors: {
          '--bg': '#fafafa',
          '--bg-card': '#ffffff',
          '--bg-panel': '#f5f5f5',
          '--bg-deep': '#ebebeb',
          '--bg-panel-focus': '#f9f9f9',
          '--bg-hover': 'rgba(57, 155, 206, 0.15)',
          '--bg-disabled': 'rgba(144, 164, 174, 0.15)',
          '--bg-highlight': 'rgba(255, 179, 0, 0.2)',
          '--bg-overlay': 'rgba(0, 0, 0, 0.3)',
          '--text-main': '#263238',
          '--text-muted': '#90a4ae',
          '--accent': '#399bce',
          '--accent-soft': 'rgba(57, 155, 206, 0.06)',
          '--accent-gold': 'rgb(255, 179, 0)',
          '--danger': '#e53935',
          '--success': '#91b859',
          '--border-subtle': 'rgba(144, 164, 174, 0.3)',
          '--border-medium': 'rgba(144, 164, 174, 0.25)',
          '--border-light': 'rgba(144, 164, 174, 0.2)',
          '--border-strong': 'rgba(144, 164, 174, 0.4)',
          '--border-section': 'rgba(144, 164, 174, 0.15)',
          '--border-divider': 'rgba(144, 164, 174, 0.1)'
        }
      },
      'gruvbox-light': {
        name: 'Gruvbox Light',
        category: 'light',
        colors: {
          '--bg': '#fbf1c7',
          '--bg-card': '#f9f5d7',
          '--bg-panel': '#f2e5bc',
          '--bg-deep': '#e8d9ae',
          '--bg-panel-focus': '#f6ecc7',
          '--bg-hover': 'rgba(175, 58, 3, 0.15)',
          '--bg-disabled': 'rgba(168, 153, 132, 0.15)',
          '--bg-highlight': 'rgba(215, 153, 33, 0.2)',
          '--bg-overlay': 'rgba(0, 0, 0, 0.3)',
          '--text-main': '#3c3836',
          '--text-muted': '#7c6f64',
          '--accent': '#af3a03',
          '--accent-soft': 'rgba(175, 58, 3, 0.06)',
          '--accent-gold': 'rgb(215, 153, 33)',
          '--danger': '#cc241d',
          '--success': '#79740e',
          '--border-subtle': 'rgba(168, 153, 132, 0.3)',
          '--border-medium': 'rgba(168, 153, 132, 0.25)',
          '--border-light': 'rgba(168, 153, 132, 0.2)',
          '--border-strong': 'rgba(168, 153, 132, 0.4)',
          '--border-section': 'rgba(168, 153, 132, 0.15)',
          '--border-divider': 'rgba(168, 153, 132, 0.1)'
        }
      }
    };

    const state = {
      selectedVariable: '--bg',
      selectedCategory: 'backgrounds',
      modifications: {}, // { varName: { dark: value, light: value } }
      highlightMode: false, // Default OFF
      currentTheme: 'dark',
      savedColors: [], // Array of hex strings, max 12
      presetFilter: 'all', // 'dark' | 'light' | 'all'
      themeUnsubscribe: null,
      currentHue: 0 // Hue for custom color canvas
    };

    // ==================== INLINE STYLES ====================
    const styles = `
      .theme-customizer-root {
        font-size: 0.9rem;
        color: var(--text-main);
      }

      .theme-customizer-section {
        margin-bottom: 1rem;
      }

      .theme-customizer-label {
        display: block;
        font-size: 0.82rem;
        font-weight: 600;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--text-muted);
        margin-bottom: 0.5rem;
      }

      .theme-category-tabs {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
      }

      .theme-category-tab {
        padding: 0.375rem 0.875rem;
        border-radius: var(--radius-sm);
        border: 1px solid var(--border-medium);
        background: var(--bg-panel);
        color: var(--text-muted);
        font-size: 0.82rem;
        cursor: pointer;
        transition: all var(--anim-fast) var(--ease-standard);
        text-align: left;
      }

      .theme-category-tab:hover {
        border-color: var(--accent);
        background: var(--bg-hover);
      }

      .theme-category-tab.active {
        border-color: var(--accent);
        background: var(--accent-soft);
        color: var(--accent);
        font-weight: 600;
      }

      .theme-category-spacer {
        height: 2rem;
      }

      .theme-highlight-btn {
        padding: 0.375rem 0.875rem;
        border-radius: var(--radius-sm);
        font-size: 0.82rem;
        cursor: pointer;
        transition: all var(--anim-fast) var(--ease-standard);
        text-align: left;
        border: 2px solid;
      }

      .theme-highlight-btn.active {
        border-color: var(--danger);
        background: rgba(255, 75, 75, 0.1);
        color: var(--danger);
        font-weight: 600;
      }

      .theme-highlight-btn.inactive {
        border-color: var(--accent);
        background: var(--accent-soft);
        color: var(--accent);
      }

      /* Two-column layout */
      .theme-editor-layout {
        display: grid;
        grid-template-columns: 1fr 200px;
        gap: 1rem;
        margin-bottom: 1rem;
      }

      @media (max-width: 600px) {
        .theme-editor-layout {
          grid-template-columns: 1fr;
        }
      }

      /* Large color picker */
      .theme-color-picker-large {
        width: 100%;
        height: 140px;
        border-radius: var(--radius-md);
        border: 1px solid var(--border-medium);
        cursor: pointer;
        background: transparent;
      }

      /* Saved colors row */
      .theme-saved-colors {
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
        align-items: center;
      }

      .theme-saved-color {
        width: 28px;
        height: 28px;
        border-radius: var(--radius-sm);
        cursor: pointer;
        border: 2px solid var(--border-medium);
        transition: all var(--anim-fast);
      }

      .theme-saved-color:hover {
        transform: scale(1.15);
        border-color: var(--accent);
      }

      .theme-save-color-btn {
        padding: 0.375rem 0.625rem;
        border-radius: var(--radius-sm);
        border: 1px dashed var(--border-medium);
        background: transparent;
        color: var(--text-muted);
        font-size: 0.72rem;
        cursor: pointer;
        transition: all var(--anim-fast);
      }

      .theme-save-color-btn:hover {
        border-color: var(--accent);
        color: var(--accent);
        background: var(--accent-soft);
      }

      /* Compact sliders */
      .theme-slider-compact-row {
        display: grid;
        grid-template-columns: 24px 1fr 44px;
        gap: 0.5rem;
        align-items: center;
        margin-bottom: 0.5rem;
      }

      .theme-slider-label {
        font-size: 0.75rem;
        font-weight: 600;
        color: var(--text-muted);
      }

      .theme-slider {
        width: 100%;
        height: 6px;
        border-radius: 3px;
        background: var(--bg-card);
        outline: none;
        appearance: none;
        -webkit-appearance: none;
      }

      .theme-slider::-webkit-slider-thumb {
        appearance: none;
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: var(--accent);
        cursor: pointer;
        border: 2px solid var(--bg);
      }

      .theme-slider::-moz-range-thumb {
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: var(--accent);
        cursor: pointer;
        border: 2px solid var(--bg);
      }

      .theme-slider-value {
        text-align: right;
        font-family: monospace;
        font-size: 0.82rem;
        color: var(--text-muted);
      }

      .theme-hex-copy-row {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 0.5rem;
        align-items: center;
      }

      .theme-hex-display {
        font-family: monospace;
        font-size: 0.86rem;
        color: var(--text-main);
        padding: 0.375rem 0.625rem;
        background: var(--bg-card);
        border-radius: var(--radius-sm);
        border: 1px solid var(--border-subtle);
      }

      .theme-copy-btn {
        padding: 0.375rem 0.75rem;
        border-radius: var(--radius-sm);
        border: 1px solid var(--border-medium);
        background: var(--bg-panel);
        color: var(--text-muted);
        font-size: 0.75rem;
        cursor: pointer;
        transition: all var(--anim-fast);
      }

      .theme-copy-btn:hover {
        background: var(--accent);
        color: var(--bg);
        border-color: var(--accent);
      }

      /* Variable list */
      .theme-variable-list {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.25rem;
        height: 240px;
        overflow-y: auto;
      }

      @media (max-width: 600px) {
        .theme-variable-list {
          grid-template-columns: 1fr;
        }
      }

      .theme-variable-item {
        display: grid;
        grid-template-columns: 20px 1fr;
        gap: 0.5rem;
        padding: 0.375rem 0.5rem;
        border-radius: var(--radius-sm);
        cursor: pointer;
        transition: all var(--anim-fast);
        border: 1px solid transparent;
      }

      .theme-variable-item:hover {
        background: var(--bg-hover);
      }

      .theme-variable-item.active {
        background: var(--accent-soft);
        border-color: var(--accent);
      }

      .theme-variable-swatch {
        width: 20px;
        height: 20px;
        border-radius: var(--radius-sm);
        border: 1px solid var(--border-subtle);
      }

      .theme-variable-name {
        font-family: monospace;
        font-size: 0.75rem;
        color: var(--text-main);
        align-self: center;
      }

      .theme-actions {
        display: flex;
        gap: 0.75rem;
        flex-wrap: wrap;
        margin-top: 1.5rem;
      }

      .theme-preset-toggle-btn {
        width: 100%;
        padding: 0.5rem 1rem;
        border-radius: var(--radius-sm);
        border: 1px solid var(--border-medium);
        background: var(--bg-panel);
        color: var(--text-main);
        font-size: 0.86rem;
        cursor: pointer;
        transition: all var(--anim-fast);
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
      }

      .theme-preset-toggle-btn:hover {
        background: var(--bg-hover);
        border-color: var(--accent);
      }

      .theme-current-value {
        font-family: monospace;
        font-size: 0.82rem;
        color: var(--text-muted);
        padding: 0.375rem 0.625rem;
        background: var(--bg-card);
        border-radius: var(--radius-sm);
        border: 1px solid var(--border-subtle);
        word-break: break-all;
      }

      /* Enhanced highlight classes - more visible */
      .theme-highlight-active {
        outline: 3px dashed var(--accent-gold) !important;
        outline-offset: 3px !important;
        box-shadow: 0 0 0 6px rgba(224, 160, 31, 0.2) !important;
      }

      .theme-highlight-category {
        outline: 2px solid var(--accent) !important;
        outline-offset: 2px !important;
      }

      .theme-preset-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
        gap: 0.75rem;
        margin-top: 0.75rem;
      }

      .theme-preset-card {
        cursor: pointer;
        border-radius: var(--radius-sm);
        overflow: hidden;
        border: 2px solid var(--border-medium);
        transition: all var(--anim-fast);
      }

      .theme-preset-card:hover {
        border-color: var(--accent);
        transform: translateY(-2px);
      }

      .theme-preset-card.active {
        border-color: var(--accent-gold);
        box-shadow: 0 0 0 2px rgba(224, 160, 31, 0.2);
      }

      .theme-preset-swatch {
        height: 60px;
        display: flex;
        flex-direction: column;
      }

      .theme-preset-swatch-strip {
        flex: 1;
      }

      .theme-preset-name {
        font-size: 0.72rem;
        text-align: center;
        padding: 0.375rem 0.25rem;
        color: var(--text-muted);
        background: var(--bg-panel);
      }

      .theme-preset-filter {
        width: 100%;
        padding: 0.375rem 0.625rem;
        border-radius: var(--radius-sm);
        border: 1px solid var(--border-strong);
        background: var(--bg-panel);
        color: var(--text-main);
        font-size: 0.86rem;
        margin-bottom: 0.5rem;
      }

      /* Custom color canvas */
      .theme-color-canvas {
        width: 100%;
        height: 120px;
        border-radius: var(--radius-sm);
        border: 1px solid var(--border-medium);
        cursor: crosshair;
      }

      .theme-hue-strip {
        width: 100%;
        height: 16px;
        border-radius: var(--radius-sm);
        border: 1px solid var(--border-medium);
        cursor: pointer;
        margin-top: 0.5rem;
      }

      /* Two-row layout */
      .theme-editor-row-top {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1.5rem;
        align-items: start;
      }

      .theme-editor-col-category {
      }

      .theme-editor-col-variables {
      }

      .theme-editor-row-color {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1rem;
        margin-bottom: 1rem;
      }

      @media (max-width: 600px) {
        .theme-editor-row-top {
          grid-template-columns: 1fr;
        }
        .theme-editor-row-color {
          grid-template-columns: 1fr;
        }
      }

      /* Preview panel layout */
      .theme-presets-with-preview {
        display: grid;
        grid-template-columns: 2fr 1fr;
        gap: 1rem;
        align-items: start;
      }

      @media (max-width: 600px) {
        .theme-presets-with-preview {
          grid-template-columns: 1fr;
        }
      }

      .theme-preview-mockup {
        border: 1px solid var(--border-medium);
        border-radius: var(--radius-md);
        overflow: hidden;
        font-size: 0.75rem;
      }
    `;

    // Create container and inject styles
    const moduleContent = document.createElement('div');
    moduleContent.className = 'theme-customizer-root';

    const styleEl = document.createElement('style');
    styleEl.textContent = styles;
    moduleContent.appendChild(styleEl);

    // ==================== HELPER FUNCTIONS ====================

    function parseColor(css) {
      // Parse hex, rgb, rgba to { r, g, b, a, hex }
      css = css.trim();

      if (css.startsWith('#')) {
        const hex = css.substring(1);
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        return { r, g, b, a: 1, hex: css };
      }

      const rgbaMatch = css.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
      if (rgbaMatch) {
        const r = parseInt(rgbaMatch[1]);
        const g = parseInt(rgbaMatch[2]);
        const b = parseInt(rgbaMatch[3]);
        const a = rgbaMatch[4] ? parseFloat(rgbaMatch[4]) : 1;
        const hex = '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
        return { r, g, b, a, hex };
      }

      return { r: 0, g: 0, b: 0, a: 1, hex: '#000000' };
    }

    function buildColorString(colorObj) {
      if (colorObj.a < 1) {
        return `rgba(${colorObj.r}, ${colorObj.g}, ${colorObj.b}, ${colorObj.a})`;
      }
      return colorObj.hex;
    }

    function getCurrentValue(varName) {
      const theme = state.currentTheme;
      if (state.modifications[varName] && state.modifications[varName][theme]) {
        return state.modifications[varName][theme];
      }
      return DEFAULT_VALUES[theme][varName] || '';
    }

    function applyLivePreview(varName, value) {
      document.documentElement.style.setProperty(varName, value);

      if (!state.modifications[varName]) {
        state.modifications[varName] = {};
      }
      state.modifications[varName][state.currentTheme] = value;
    }

    function highlightVariable(varName) {
      // Remove previous highlights
      document.querySelectorAll('.theme-highlight-active, .theme-highlight-category').forEach(el => {
        el.classList.remove('theme-highlight-active', 'theme-highlight-category');
      });

      if (!state.highlightMode) return;

      // Get all variables in the current category
      const categoryVars = VARIABLE_CATEGORIES[state.selectedCategory];
      const matchingSelectors = {};

      // Parse all stylesheets for selectors using these variables
      for (const sheet of document.styleSheets) {
        try {
          const rules = sheet.cssRules || sheet.rules;
          if (!rules) continue;

          for (const rule of rules) {
            if (!rule.cssText || !rule.selectorText) continue;

            // Check for all category variables
            categoryVars.forEach(catVar => {
              const searchPattern = `var(${catVar})`;
              if (rule.cssText.includes(searchPattern)) {
                if (!matchingSelectors[catVar]) {
                  matchingSelectors[catVar] = [];
                }
                matchingSelectors[catVar].push(rule.selectorText);
              }
            });
          }
        } catch (e) {
          // Skip cross-origin stylesheets
        }
      }

      // Apply highlights: active variable gets gold dashed, others get gray solid
      Object.entries(matchingSelectors).forEach(([varName, selectors]) => {
        const isActive = varName === state.selectedVariable;
        const className = isActive ? 'theme-highlight-active' : 'theme-highlight-category';

        selectors.forEach(selector => {
          try {
            document.querySelectorAll(selector).forEach(el => {
              el.classList.add(className);
            });
          } catch (e) {
            // Skip invalid selectors
          }
        });
      });
    }

    function exportThemeCSS() {
      const theme = state.currentTheme;
      let css = `/* Custom Theme CSS - ${theme === 'dark' ? 'Dark' : 'Light'} Mode */\n`;
      css += `:root${theme === 'light' ? '[data-theme="light"]' : ''} {\n`;

      // Export all variables from VARIABLE_CATEGORIES
      const allVars = Object.values(VARIABLE_CATEGORIES).flat();
      allVars.forEach(varName => {
        const value = getCurrentValue(varName);
        if (value) css += `  ${varName}: ${value};\n`;
      });

      css += '}\n';
      return css;
    }

    function downloadThemeCSS() {
      const css = exportThemeCSS();
      const blob = new Blob([css], { type: 'text/css' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `theme-${state.currentTheme}-${Date.now()}.css`;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
      console.log('[ThemeCustomizer] Theme exported');
    }

    function resetVariable() {
      const varName = state.selectedVariable;
      const theme = state.currentTheme;

      // Remove inline override - let CSS cascade handle the default
      document.documentElement.style.removeProperty(varName);

      if (state.modifications[varName]) {
        delete state.modifications[varName][theme];
      }

      renderEditor();
      console.log('[ThemeCustomizer] Reset variable:', varName);
    }

    function resetAll() {
      // Remove all inline overrides - let CSS cascade handle defaults
      Object.values(VARIABLE_CATEGORIES).flat().forEach(varName => {
        document.documentElement.style.removeProperty(varName);
      });

      state.modifications = {};
      renderEditor();
      renderVariableList();
      console.log('[ThemeCustomizer] Reset all variables');
    }

    function copyHexToClipboard() {
      const varName = state.selectedVariable;
      const currentValue = getCurrentValue(varName);
      const colorObj = parseColor(currentValue);

      navigator.clipboard.writeText(colorObj.hex).then(() => {
        console.log('[ThemeCustomizer] Copied hex:', colorObj.hex);
        // Brief visual feedback
        const btn = moduleContent.querySelector('#copyHexBtn');
        if (btn) {
          const originalText = btn.textContent;
          btn.textContent = 'Copied!';
          setTimeout(() => {
            btn.textContent = originalText;
          }, 1000);
        }
      });
    }

    // ==================== UI RENDERING ====================

    function renderCategoryTabs() {
      const container = moduleContent.querySelector('#categoryTabs');
      container.innerHTML = '';

      Object.keys(VARIABLE_CATEGORIES).forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'theme-category-tab' + (cat === state.selectedCategory ? ' active' : '');
        btn.textContent = cat.charAt(0).toUpperCase() + cat.slice(1);
        btn.onclick = () => {
          state.selectedCategory = cat;
          state.selectedVariable = VARIABLE_CATEGORIES[cat][0];
          renderCategoryTabs();
          renderVariableList();
          renderEditor();
        };
        container.appendChild(btn);
      });

      // Add invisible spacer row (same height as a category button)
      const spacer = document.createElement('div');
      spacer.className = 'theme-category-spacer';
      container.appendChild(spacer);

      // Add Highlight UI as a distinct toggle button
      const highlightBtn = document.createElement('button');
      highlightBtn.className = 'theme-highlight-btn ' + (state.highlightMode ? 'active' : 'inactive');
      highlightBtn.innerHTML = state.highlightMode
        ? '● Highlight UI'
        : '○ Highlight UI';
      highlightBtn.onclick = () => {
        state.highlightMode = !state.highlightMode;
        renderCategoryTabs();
        highlightVariable(state.selectedVariable);
      };
      container.appendChild(highlightBtn);
    }

    function renderVariableList() {
      const container = moduleContent.querySelector('#variableList');
      container.innerHTML = '';

      const vars = VARIABLE_CATEGORIES[state.selectedCategory];
      vars.forEach(varName => {
        const item = document.createElement('div');
        item.className = 'theme-variable-item' + (varName === state.selectedVariable ? ' active' : '');

        const swatch = document.createElement('div');
        swatch.className = 'theme-variable-swatch';
        swatch.style.background = getCurrentValue(varName);

        const name = document.createElement('div');
        name.className = 'theme-variable-name';
        name.textContent = varName;

        item.appendChild(swatch);
        item.appendChild(name);

        item.onclick = () => {
          state.selectedVariable = varName;
          renderVariableList();
          renderEditor();
        };

        container.appendChild(item);
      });
    }

    function saveCurrentColor() {
      const varName = state.selectedVariable;
      const currentValue = getCurrentValue(varName);
      const colorObj = parseColor(currentValue);

      // Only save if not already in palette
      if (!state.savedColors.includes(colorObj.hex)) {
        state.savedColors.unshift(colorObj.hex);
        // Keep max 12 colors
        if (state.savedColors.length > 12) {
          state.savedColors.pop();
        }
        renderSavedColors();
      }
    }

    function applySavedColor(hexColor) {
      const varName = state.selectedVariable;
      const currentValue = getCurrentValue(varName);
      const supportsAlpha = ALPHA_VARIABLES.includes(varName);

      let newValue = hexColor;

      // If current value has alpha, preserve it
      if (supportsAlpha && currentValue.includes('rgba')) {
        const colorObj = parseColor(currentValue);
        const newColorObj = parseColor(hexColor);
        newValue = buildColorString({ ...newColorObj, a: colorObj.a });
      }

      applyLivePreview(varName, newValue);
      renderEditor();
    }

    function renderSavedColors() {
      const container = moduleContent.querySelector('#savedColorsContainer');
      if (!container) return;

      container.innerHTML = '';

      state.savedColors.forEach(hexColor => {
        const swatch = document.createElement('div');
        swatch.className = 'theme-saved-color';
        swatch.style.background = hexColor;
        swatch.title = hexColor;
        swatch.onclick = () => applySavedColor(hexColor);
        container.appendChild(swatch);
      });

      const saveBtn = document.createElement('button');
      saveBtn.className = 'theme-save-color-btn';
      saveBtn.textContent = '+ Save';
      saveBtn.onclick = saveCurrentColor;
      container.appendChild(saveBtn);
    }

    function renderColorEditor() {
      const editorContainer = moduleContent.querySelector('#themeEditorContainer');
      const varName = state.selectedVariable;
      const currentValue = getCurrentValue(varName);
      const colorObj = parseColor(currentValue);
      const supportsAlpha = ALPHA_VARIABLES.includes(varName);

      editorContainer.innerHTML = `
        <div class="theme-editor-row-color">
          <div id="colorCanvasContainer"></div>
          <div>
            <div class="theme-hex-copy-row" style="margin-bottom: 0.75rem;">
              <div class="theme-hex-display" id="hexDisplay">${colorObj.hex}</div>
              <button class="theme-copy-btn" id="copyHexBtn">Copy</button>
            </div>
            <div class="theme-slider-compact-row">
              <span class="theme-slider-label">R</span>
              <input type="range" id="rSlider" class="theme-slider" min="0" max="255" value="${colorObj.r}" />
              <span class="theme-slider-value" id="rValue">${colorObj.r}</span>
            </div>
            <div class="theme-slider-compact-row">
              <span class="theme-slider-label">G</span>
              <input type="range" id="gSlider" class="theme-slider" min="0" max="255" value="${colorObj.g}" />
              <span class="theme-slider-value" id="gValue">${colorObj.g}</span>
            </div>
            <div class="theme-slider-compact-row">
              <span class="theme-slider-label">B</span>
              <input type="range" id="bSlider" class="theme-slider" min="0" max="255" value="${colorObj.b}" />
              <span class="theme-slider-value" id="bValue">${colorObj.b}</span>
            </div>
            ${supportsAlpha ? `
              <div class="theme-slider-compact-row">
                <span class="theme-slider-label">A</span>
                <input type="range" id="aSlider" class="theme-slider" min="0" max="100" value="${Math.round(colorObj.a * 100)}" />
                <span class="theme-slider-value" id="aValue">${colorObj.a.toFixed(2)}</span>
              </div>
            ` : ''}
          </div>
        </div>

        <div class="theme-customizer-section">
          <span class="theme-customizer-label">Saved Colors</span>
          <div class="theme-saved-colors" id="savedColorsContainer"></div>
        </div>
      `;

      // Render custom color canvas
      const canvasContainer = editorContainer.querySelector('#colorCanvasContainer');
      const { canvas, hueStrip } = renderColorCanvas();
      canvasContainer.appendChild(canvas);
      canvasContainer.appendChild(hueStrip);

      renderSavedColors();

      // Setup event handlers
      const rSlider = editorContainer.querySelector('#rSlider');
      const gSlider = editorContainer.querySelector('#gSlider');
      const bSlider = editorContainer.querySelector('#bSlider');
      const aSlider = editorContainer.querySelector('#aSlider');
      const hexDisplay = editorContainer.querySelector('#hexDisplay');
      const copyBtn = editorContainer.querySelector('#copyHexBtn');

      function syncFromRGB() {
        const r = parseInt(rSlider.value);
        const g = parseInt(gSlider.value);
        const b = parseInt(bSlider.value);
        const a = aSlider ? parseFloat(aSlider.value) / 100 : 1;

        editorContainer.querySelector('#rValue').textContent = r;
        editorContainer.querySelector('#gValue').textContent = g;
        editorContainer.querySelector('#bValue').textContent = b;
        if (aSlider) {
          editorContainer.querySelector('#aValue').textContent = a.toFixed(2);
        }

        const hex = '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
        const colorStr = buildColorString({ r, g, b, a, hex });

        hexDisplay.textContent = hex;
        applyLivePreview(varName, colorStr);
        highlightVariable(varName);

        // Update variable list swatch
        renderVariableList();
        renderPreviewPanel();
      }

      rSlider.oninput = syncFromRGB;
      gSlider.oninput = syncFromRGB;
      bSlider.oninput = syncFromRGB;
      if (aSlider) aSlider.oninput = syncFromRGB;
      copyBtn.onclick = copyHexToClipboard;
    }

    function applyPreset(presetId) {
      const preset = THEME_PRESETS[presetId];
      if (!preset) return;

      console.log('[ThemeCustomizer] Applying preset:', preset.name);

      // If different theme mode, store colors in modifications BEFORE toggling
      if (preset.category !== state.currentTheme) {
        console.log('[ThemeCustomizer] Switching theme mode from', state.currentTheme, 'to', preset.category);

        // Store colors in modifications for the TARGET theme
        Object.entries(preset.colors).forEach(([varName, value]) => {
          if (!state.modifications[varName]) {
            state.modifications[varName] = {};
          }
          state.modifications[varName][preset.category] = value;
        });

        // Toggle theme - the subscription handler will reapply modifications
        themeController.toggleTheme();
      } else {
        // Same theme, apply directly
        applyPresetColors(preset);
      }
    }

    function applyPresetColors(preset) {
      // Apply all colors from the preset
      Object.entries(preset.colors).forEach(([varName, value]) => {
        applyLivePreview(varName, value);
      });

      renderEditor();
      renderVariableList();
    }

    function renderColorCanvas() {
      // Create saturation/value gradient canvas
      const canvas = document.createElement('canvas');
      canvas.id = 'colorCanvas';
      canvas.className = 'theme-color-canvas';
      canvas.width = 200;
      canvas.height = 150;

      // Create hue slider strip
      const hueStrip = document.createElement('canvas');
      hueStrip.id = 'hueStrip';
      hueStrip.className = 'theme-hue-strip';
      hueStrip.width = 200;
      hueStrip.height = 20;

      // Draw saturation/value gradient
      function drawSatValGradient(hue) {
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;

        // Create white-to-hue horizontal gradient
        const gradH = ctx.createLinearGradient(0, 0, width, 0);
        gradH.addColorStop(0, '#ffffff');
        gradH.addColorStop(1, `hsl(${hue}, 100%, 50%)`);
        ctx.fillStyle = gradH;
        ctx.fillRect(0, 0, width, height);

        // Create transparent-to-black vertical gradient
        const gradV = ctx.createLinearGradient(0, 0, 0, height);
        gradV.addColorStop(0, 'rgba(0,0,0,0)');
        gradV.addColorStop(1, 'rgba(0,0,0,1)');
        ctx.fillStyle = gradV;
        ctx.fillRect(0, 0, width, height);
      }

      // Draw hue strip (rainbow)
      function drawHueStrip() {
        const ctx = hueStrip.getContext('2d');
        const width = hueStrip.width;
        const height = hueStrip.height;
        const grad = ctx.createLinearGradient(0, 0, width, 0);
        for (let i = 0; i <= 360; i += 60) {
          grad.addColorStop(i / 360, `hsl(${i}, 100%, 50%)`);
        }
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);
      }

      // Handle canvas click to pick color
      canvas.onclick = (e) => {
        const rect = canvas.getBoundingClientRect();
        // Scale coordinates to internal canvas dimensions
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;
        const ctx = canvas.getContext('2d');
        const pixel = ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data;
        updateColorFromRGB(pixel[0], pixel[1], pixel[2]);
      };

      // Handle hue strip click
      hueStrip.onclick = (e) => {
        const rect = hueStrip.getBoundingClientRect();
        // Scale coordinates to internal canvas dimensions
        const scaleX = hueStrip.width / rect.width;
        const x = (e.clientX - rect.left) * scaleX;
        const hue = Math.round((x / hueStrip.width) * 360);
        state.currentHue = hue;
        drawSatValGradient(hue);
      };

      // Helper to update color from RGB values
      function updateColorFromRGB(r, g, b) {
        const varName = state.selectedVariable;
        const currentValue = getCurrentValue(varName);
        const supportsAlpha = ALPHA_VARIABLES.includes(varName);

        let a = 1;
        if (supportsAlpha && currentValue.includes('rgba')) {
          const colorObj = parseColor(currentValue);
          a = colorObj.a;
        }

        const hex = '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
        const colorStr = buildColorString({ r, g, b, a, hex });
        applyLivePreview(varName, colorStr);
        renderEditor();
      }

      // Initialize
      drawSatValGradient(state.currentHue);
      drawHueStrip();

      return { canvas, hueStrip };
    }

    function renderPreviewPanel() {
      const container = moduleContent.querySelector('#previewPanel');
      if (!container) return;

      container.innerHTML = `
        <div class="theme-preview-mockup">
          <div class="theme-preview-header" style="background: var(--bg-panel); border-bottom: 1px solid var(--border-medium); padding: 0.5rem;">
            <span style="color: var(--text-main); font-weight: 600; font-size: 0.75rem;">Header</span>
            <span style="color: var(--accent); font-size: 0.75rem; float: right;">●</span>
          </div>
          <div class="theme-preview-body" style="display: grid; grid-template-columns: 60px 1fr; height: 282px;">
            <div class="theme-preview-sidebar" style="background: var(--bg-panel); border-right: 1px solid var(--border-subtle); padding: 0.5rem;">
              <div style="background: var(--bg-hover); border-radius: 4px; height: 20px; margin-bottom: 4px;"></div>
              <div style="background: var(--accent-soft); border-radius: 4px; height: 20px; border: 1px solid var(--accent); margin-bottom: 4px;"></div>
              <div style="background: var(--bg-hover); border-radius: 4px; height: 20px; margin-bottom: 4px;"></div>
              <div style="background: var(--bg-hover); border-radius: 4px; height: 20px; margin-bottom: 4px;"></div>
              <div style="background: var(--bg-hover); border-radius: 4px; height: 20px;"></div>
            </div>
            <div class="theme-preview-main" style="background: var(--bg); padding: 0.5rem;">
              <div style="background: var(--bg-card); border-radius: 6px; padding: 0.5rem; border: 1px solid var(--border-subtle); margin-bottom: 0.5rem;">
                <div style="color: var(--text-main); font-size: 0.75rem; font-weight: 600;">Card Title</div>
                <div style="color: var(--text-muted); font-size: 0.65rem;">Muted text description</div>
              </div>
              <div style="background: var(--bg-card); border-radius: 6px; padding: 0.5rem; border: 1px solid var(--border-subtle); margin-bottom: 0.5rem;">
                <div style="color: var(--text-main); font-size: 0.75rem; font-weight: 600;">Second Card</div>
                <div style="color: var(--text-muted); font-size: 0.65rem;">More content here</div>
              </div>
              <div style="background: var(--bg-highlight); border-radius: 6px; padding: 0.5rem; margin-bottom: 0.5rem;">
                <div style="color: var(--accent-gold); font-size: 0.65rem;">● Highlighted area</div>
              </div>
              <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                <span style="background: var(--accent); color: var(--bg); padding: 2px 8px; border-radius: 4px; font-size: 0.65rem;">Button</span>
                <span style="background: var(--danger); color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.65rem;">Danger</span>
                <span style="background: var(--success); color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.65rem;">Success</span>
              </div>
            </div>
          </div>
          <div class="theme-preview-footer" style="padding: 0.5rem; background: var(--bg-panel); border-top: 1px solid var(--border-medium);">
            <span style="color: var(--accent-gold); font-size: 0.65rem;">● Highlight</span>
            <span style="color: var(--border-strong); font-size: 0.65rem; margin-left: 0.5rem;">| Border</span>
          </div>
        </div>
      `;
    }

    function renderPresets() {
      const container = moduleContent.querySelector('#presetsContainer');
      if (!container) return;

      const grid = container.querySelector('#presetGrid');
      grid.innerHTML = '';

      // Filter presets by current theme
      const filter = state.currentTheme;

      Object.entries(THEME_PRESETS).forEach(([presetId, preset]) => {
        // Only show presets matching current theme
        if (preset.category !== filter) {
          return;
        }

        const card = document.createElement('div');
        card.className = 'theme-preset-card';
        card.onclick = () => applyPreset(presetId);

        // Create color swatch with strips (show first 5 colors)
        const swatch = document.createElement('div');
        swatch.className = 'theme-preset-swatch';

        const colorKeys = Object.keys(preset.colors).slice(0, 5);
        colorKeys.forEach(varName => {
          const strip = document.createElement('div');
          strip.className = 'theme-preset-swatch-strip';
          strip.style.background = preset.colors[varName];
          swatch.appendChild(strip);
        });

        const name = document.createElement('div');
        name.className = 'theme-preset-name';
        name.textContent = preset.name;

        card.appendChild(swatch);
        card.appendChild(name);
        grid.appendChild(card);
      });

      // Render preview panel after presets
      renderPreviewPanel();
    }

    function renderEditor() {
      renderColorEditor();
      highlightVariable(state.selectedVariable);
      renderPreviewPanel();
    }

    function updateThemeIndicator() {
      // Update theme toggle button
      const toggleIcon = moduleContent.querySelector('#themeToggleIcon');
      const toggleText = moduleContent.querySelector('#themeToggleText');
      if (toggleIcon && toggleText) {
        if (state.currentTheme === 'dark') {
          toggleIcon.textContent = '🌙';
          toggleText.textContent = 'Dark Mode';
        } else {
          toggleIcon.textContent = '☀️';
          toggleText.textContent = 'Light Mode';
        }
      }
    }

    // ==================== MAIN UI ====================

    moduleContent.innerHTML += `
      <header class="shared-module-header">
        <div class="shared-module-title-row">
          <h1>Theme Customizer</h1>
        </div>
        <p class="shared-module-subtitle">
          <span>Customize theme colors by editing CSS variables in real-time.</span>
          <span>Choose from 19 curated presets or create your own custom theme.</span>
        </p>
      </header>

      <div class="shared-module-panel">
        <div class="shared-module-panel-title">Theme Presets</div>

        <div class="theme-presets-with-preview">
          <div class="theme-customizer-section" id="presetsContainer">
            <button id="themeToggleBtn" class="theme-preset-toggle-btn">
              <span id="themeToggleIcon">🌙</span>
              <span id="themeToggleText">Dark Mode</span>
            </button>
            <div class="theme-preset-grid" id="presetGrid" style="margin-top: 0.75rem;"></div>
          </div>
          <div id="previewPanel"></div>
        </div>
      </div>

      <div class="shared-module-panel">
        <div class="shared-module-panel-title">Theme Editor</div>

        <div class="theme-editor-row-top">
          <div class="theme-editor-col-category">
            <span class="theme-customizer-label">Category</span>
            <div class="theme-category-tabs" id="categoryTabs"></div>
          </div>
          <div class="theme-editor-col-variables">
            <span class="theme-customizer-label">Variables</span>
            <div id="variableList" class="theme-variable-list"></div>
          </div>
        </div>

        <div id="themeEditorContainer"></div>

        <div class="theme-actions">
          <button class="shared-btn" id="resetVarBtn">Reset Variable</button>
          <button class="shared-btn" id="resetAllBtn">Reset All</button>
          <button class="shared-btn shared-btn-primary" id="exportBtn">Export Theme CSS</button>
        </div>
      </div>
    `;

    container.appendChild(moduleContent);

    // ==================== EVENT LISTENERS ====================

    moduleContent.querySelector('#resetVarBtn').onclick = resetVariable;
    moduleContent.querySelector('#resetAllBtn').onclick = resetAll;
    moduleContent.querySelector('#exportBtn').onclick = downloadThemeCSS;

    // Theme toggle button
    const themeToggleBtn = moduleContent.querySelector('#themeToggleBtn');
    if (themeToggleBtn) {
      themeToggleBtn.onclick = () => {
        console.log('[ThemeCustomizer] Toggle theme clicked');
        if (themeController && themeController.toggleTheme) {
          themeController.toggleTheme();
        } else {
          console.error('[ThemeCustomizer] themeController.toggleTheme not available');
        }
      };
    }

    // Subscribe to theme changes
    if (themeController && themeController.subscribe) {
      // Get initial theme from controller
      state.currentTheme = themeController.getCurrentTheme();
      updateThemeIndicator();

      // Capture defaults for the current theme at init time
      DEFAULT_VALUES[state.currentTheme] = captureCurrentDefaults();
      console.log('[ThemeCustomizer] Captured defaults for theme:', state.currentTheme);

      // Capture defaults for the OTHER theme by temporarily switching data-theme
      // This ensures clean defaults are captured before any modifications are applied
      const otherTheme = state.currentTheme === 'dark' ? 'light' : 'dark';
      const htmlEl = document.documentElement;
      if (otherTheme === 'light') {
        htmlEl.setAttribute('data-theme', 'light');
      } else {
        htmlEl.removeAttribute('data-theme');
      }
      // Force style recalculation
      getComputedStyle(htmlEl).getPropertyValue('--bg');
      DEFAULT_VALUES[otherTheme] = captureCurrentDefaults();
      console.log('[ThemeCustomizer] Captured defaults for theme:', otherTheme);
      // Restore original theme
      if (state.currentTheme === 'light') {
        htmlEl.setAttribute('data-theme', 'light');
      } else {
        htmlEl.removeAttribute('data-theme');
      }

      state.themeUnsubscribe = themeController.subscribe((newTheme) => {
        console.log('[ThemeCustomizer] Theme changed to:', newTheme);
        state.currentTheme = newTheme;

        // Step 1: Remove ALL inline style overrides so the CSS cascade takes effect cleanly
        const allVars = Object.values(VARIABLE_CATEGORIES).flat();
        allVars.forEach(varName => {
          document.documentElement.style.removeProperty(varName);
        });

        // Step 2: Reapply ONLY the new theme's modifications
        Object.keys(state.modifications).forEach(varName => {
          const value = state.modifications[varName][newTheme];
          if (value) {
            document.documentElement.style.setProperty(varName, value);
          }
        });

        // Update UI
        updateThemeIndicator();
        renderEditor();
        renderPresets(); // Re-render presets to show current theme's presets
      });
    } else {
      // Fallback: Detect initial theme from DOM
      const htmlEl = document.documentElement;
      state.currentTheme = htmlEl.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
      updateThemeIndicator();

      // Capture defaults for the current theme
      DEFAULT_VALUES[state.currentTheme] = captureCurrentDefaults();
    }

    // Initial render
    renderCategoryTabs();
    renderVariableList();
    renderEditor();
    renderPresets();

    console.log('[ThemeCustomizer] Initialized successfully');

    // ==================== MODULE API ====================

    return {
      getState() {
        console.log('[ThemeCustomizer] Getting state');
        return {
          modifications: state.modifications,
          selectedVariable: state.selectedVariable,
          selectedCategory: state.selectedCategory,
          savedColors: state.savedColors
        };
      },

      setState(saved) {
        console.log('[ThemeCustomizer] Setting state:', saved);
        if (saved) {
          state.modifications = saved.modifications || {};
          state.selectedVariable = saved.selectedVariable || '--bg';
          state.selectedCategory = saved.selectedCategory || 'backgrounds';
          state.savedColors = saved.savedColors || [];

          // Reapply modifications
          Object.keys(state.modifications).forEach(varName => {
            const value = state.modifications[varName][state.currentTheme];
            if (value) {
              document.documentElement.style.setProperty(varName, value);
            }
          });

          renderCategoryTabs();
          renderVariableList();
          renderEditor();
          renderPresets();
        }
      },

      destroy() {
        console.log('[ThemeCustomizer] Destroying');

        // Remove all CSS variable overrides
        Object.values(VARIABLE_CATEGORIES).flat().forEach(varName => {
          document.documentElement.style.removeProperty(varName);
        });

        // Remove highlights
        document.querySelectorAll('.theme-highlight-active, .theme-highlight-category').forEach(el => {
          el.classList.remove('theme-highlight-active', 'theme-highlight-category');
        });

        // Unsubscribe from theme controller
        if (state.themeUnsubscribe) {
          state.themeUnsubscribe();
        }

        container.innerHTML = '';
      }
    };
  }

  // Register globally
  window.createThemeCustomizer = createThemeCustomizer;
  console.log('[ThemeCustomizer] Module registered');
})();
