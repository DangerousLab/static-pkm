/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  // Use 'selector' strategy with data-theme attribute
  // Base styles are dark theme, data-theme="light" triggers light mode
  darkMode: ['selector', '[data-theme="light"]'],
  theme: {
    extend: {
      // Colors using CSS custom properties for theme-aware values
      colors: {
        // Theme-aware colors (use var() for CSS variables)
        bg: {
          DEFAULT: 'var(--tw-bg)',
          card: 'var(--tw-bg-card)',
          panel: 'var(--tw-bg-panel)',
          hover: 'var(--tw-bg-hover)',
        },
        text: {
          main: 'var(--tw-text-main)',
          muted: 'var(--tw-text-muted)',
        },
        border: {
          subtle: 'var(--tw-border-subtle)',
          medium: 'var(--tw-border-medium)',
        },
        accent: {
          DEFAULT: 'var(--tw-accent)',
          gold: 'rgb(224, 160, 31)',
        },
        // Semantic colors (same in both themes)
        danger: 'var(--tw-danger)',
        success: 'var(--tw-success)',
      },
      // Spacing scale
      spacing: {
        xs: '0.25rem', // 4px
        sm: '0.5rem', // 8px
        md: '1rem', // 16px
        lg: '1.5rem', // 24px
        xl: '2rem', // 32px
        // Layout values
        sidebar: '240px',
        'header-height': '90px',
        'header-mobile': '44px',
        'landscape-bar': '44px',
      },
      // Gap scale
      gap: {
        xs: '0.375rem', // 6px
        sm: '0.5rem', // 8px
        md: '0.625rem', // 10px
        lg: '0.875rem', // 14px
        xl: '1rem', // 16px
      },
      // Border radius
      borderRadius: {
        sm: '0.5rem', // 8px
        md: '0.875rem', // 14px
        lg: '1.125rem', // 18px
        full: '999px',
      },
      // Animation timing
      transitionDuration: {
        fast: '150ms',
        normal: '200ms',
        slow: '400ms',
      },
      // Animation delays
      transitionDelay: {
        1: '75ms',
        2: '150ms',
      },
      // Custom gradients
      backgroundImage: {
        'gradient-bg': 'var(--tw-gradient-bg)',
        'gradient-sidebar': 'var(--tw-gradient-sidebar)',
        'gradient-card': 'var(--tw-gradient-card)',
      },
      // Font family
      fontFamily: {
        sans: [
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Text"',
          '"Segoe UI"',
          'sans-serif',
        ],
        'uni-sans': ['"Uni Sans"', 'sans-serif'],
      },
      // Breakpoints
      screens: {
        mobile: '600px',
        tablet: '768px',
        sidebar: '840px',
        desktop: '1024px',
      },
      // Keyframes for animations
      keyframes: {
        slideUpFade: {
          from: {
            opacity: '0',
            transform: 'translateY(12px)',
          },
          to: {
            opacity: '1',
            transform: 'translateY(0)',
          },
        },
      },
      animation: {
        'slide-up-fade': 'slideUpFade 0.4s ease-out forwards',
        'slide-up-fade-delay-1': 'slideUpFade 0.4s ease-out 75ms forwards',
        'slide-up-fade-delay-2': 'slideUpFade 0.4s ease-out 150ms forwards',
      },
    },
  },
  plugins: [],
};
