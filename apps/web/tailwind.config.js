/** @type {import('tailwindcss').Config} */
import plugin from 'tailwindcss/plugin.js';
import { buildPalette, gray, primary } from './theme.palette.js';

// Light/dark colour system — see theme.palette.js for the why.
const { themeColors, lightVars, darkVars } = buildPalette();

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  // `data-theme="dark"` on <html> is set before first paint by the inline
  // script in index.html (no flash), then kept in sync by src/lib/theme.ts.
  // An attribute, not a class: Tailwind prunes base rules whose class it never
  // sees in the sources, which silently dropped the whole dark variable block.
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      // Mirrors the widget's scale so the custom-widget editor preview can be
      // written with the same class names it is previewing (FIX-260917). The
      // console itself is not themed — only the preview box sets these vars.
      borderRadius: {
        'st-xs': 'var(--ivy-radius-xs, 4px)',
        'st-sm': 'var(--ivy-radius-sm, 6px)',
        'st-md': 'var(--ivy-radius-md, 8px)',
        'st-lg': 'var(--ivy-radius-lg, 12px)',
        'st-xl': 'var(--ivy-radius-xl, 16px)',
      },
      colors: {
        primary,
        success: '#10B981',
        warning: '#F59E0B',
        error: '#EF4444',
        info: '#3B82F6',
        gray,
        // Semantic surfaces (new shell + components).
        page: 'rgb(var(--st-page) / <alpha-value>)',
        surface: {
          DEFAULT: 'rgb(var(--st-surface) / <alpha-value>)',
          2: 'rgb(var(--st-surface-2) / <alpha-value>)',
          elevated: 'rgb(var(--st-elevated) / <alpha-value>)',
          sidebar: 'rgb(var(--st-sidebar) / <alpha-value>)',
        },
        line: 'rgb(var(--st-border) / <alpha-value>)',
        ink: {
          DEFAULT: 'rgb(var(--st-ink) / <alpha-value>)',
          2: 'rgb(var(--st-ink-2) / <alpha-value>)',
          3: 'rgb(var(--st-ink-3) / <alpha-value>)',
        },
      },
      // Per-utility colour maps: the same class name resolves to a job-specific
      // value in dark mode (tints go dark, text on tints goes light).
      backgroundColor: themeColors.bg,
      gradientColorStops: themeColors.bg,
      textColor: themeColors.text,
      placeholderColor: themeColors.text,
      fill: themeColors.text,
      stroke: themeColors.text,
      borderColor: themeColors.border,
      divideColor: themeColors.border,
      ringColor: themeColors.border,
      ringOffsetColor: { white: themeColors.bg.white },
      fontFamily: {
        sans: ['Pretendard', '-apple-system', 'BlinkMacSystemFont', "'Segoe UI'", 'Roboto', 'sans-serif'],
      },
      maxWidth: {
        content: '1440px',
      },
      spacing: {
        header: '64px',
        sidebar: '240px',
        'sidebar-collapsed': '64px',
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(16 24 40 / 0.04), 0 1px 3px 0 rgb(16 24 40 / 0.04)',
        pop: '0 12px 32px -8px rgb(16 24 40 / 0.18), 0 4px 8px -4px rgb(16 24 40 / 0.08)',
      },
      keyframes: {
        'st-fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'st-pop-in': {
          from: { opacity: '0', transform: 'translateY(4px) scale(0.98)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'st-slide-in': { from: { transform: 'translateX(-100%)' }, to: { transform: 'translateX(0)' } },
        'st-slide-in-right': { from: { transform: 'translateX(100%)' }, to: { transform: 'translateX(0)' } },
      },
      animation: {
        'st-fade-in': 'st-fade-in 120ms ease-out',
        'st-pop-in': 'st-pop-in 140ms ease-out',
        'st-slide-in': 'st-slide-in 180ms ease-out',
        'st-slide-in-right': 'st-slide-in-right 200ms ease-out',
      },
    },
  },
  plugins: [
    plugin(({ addBase }) => {
      addBase({
        ':root': lightVars,
        ':root[data-theme="dark"]': darkVars,
        // Previews of the shopper widget stay light inside a dark console.
        '[data-theme="dark"] [data-theme="light"]': lightVars,
        '@media print': { ':root[data-theme="dark"]': lightVars },
      });
    }),
  ],
};
