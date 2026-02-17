/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      // Colors migrated from CSS variables in styles.css
      colors: {
        // Base colors (dark theme defaults)
        bg: {
          DEFAULT: '#3c3c3c',
          card: '#303030',
          panel: '#262626',
          hover: 'rgba(80, 80, 80, 0.35)',
          disabled: 'rgba(128, 128, 128, 0.2)',
          highlight: 'rgba(224, 160, 31, 0.25)',
        },
        // Text colors
        text: {
          main: '#f5f5f5',
          muted: '#c4c4c4',
        },
        // Border colors
        border: {
          subtle: 'rgba(120, 120, 120, 0.7)',
          medium: 'rgba(148, 148, 148, 0.6)',
          light: 'rgba(180, 180, 180, 0.5)',
          strong: 'rgba(160, 160, 160, 0.55)',
        },
        // Accent colors
        accent: {
          DEFAULT: '#e5e5e5',
          soft: 'rgba(229, 229, 229, 0.08)',
          gold: 'rgb(224, 160, 31)',
        },
        // Semantic colors
        danger: '#ff4b4b',
        success: '#4ade80',
        // Light theme overrides (use dark: prefix in Tailwind)
        light: {
          bg: '#f3f4f6',
          'bg-card': '#ffffff',
          'bg-panel': '#f9fafb',
          'bg-hover': 'rgba(148, 163, 184, 0.25)',
          'text-main': '#111111',
          'text-muted': '#6b7280',
          accent: '#111111',
          danger: '#dc2626',
          success: '#16a34a',
        },
      },
      // Spacing scale from CSS variables
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
      // Gap scale from CSS variables
      gap: {
        xs: '0.375rem', // 6px
        sm: '0.5rem', // 8px
        md: '0.625rem', // 10px
        lg: '0.875rem', // 14px
        xl: '1rem', // 16px
      },
      // Border radius from CSS variables
      borderRadius: {
        sm: '0.5rem', // 8px
        md: '0.875rem', // 14px
        lg: '1.125rem', // 18px
        full: '999px',
      },
      // Animation timing from CSS variables
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
      // Custom gradients matching CSS variables
      backgroundImage: {
        'gradient-bg':
          'radial-gradient(circle at top, #2f2f2f 0, #2a2a2a 55%, #1f1f1f 100%)',
        'gradient-sidebar':
          'radial-gradient(circle at top left, rgba(31, 31, 31, 0.96), rgba(31, 31, 31, 0.9))',
        'gradient-card':
          'radial-gradient(circle at top left, #303030, #262626 45%, #1a1a1a 100%)',
        // Light theme gradients
        'gradient-bg-light':
          'radial-gradient(circle at top, #e5e7eb 0, #e5e7eb 50%, #d1d5db 100%)',
        'gradient-sidebar-light':
          'radial-gradient(circle at top left, #f9fafb, #e5e7eb)',
        'gradient-card-light':
          'radial-gradient(circle at top left, #ffffff, #f9fafb 40%, #e5e7eb 100%)',
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
      // Breakpoints matching CSS variables reference
      screens: {
        mobile: '600px',
        tablet: '768px',
        sidebar: '840px',
        desktop: '1024px',
      },
      // Keyframes for slideUpFade animation
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
