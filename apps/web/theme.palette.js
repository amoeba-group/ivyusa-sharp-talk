/**
 * Console colour system — light / dark (REQ-261030 Console UX refresh).
 *
 * Every screen in the console is written with plain Tailwind colour classes
 * (`bg-white`, `text-gray-700`, `border-gray-200`, `bg-amber-50` …). Rewriting
 * ~2,000 of those by hand to add `dark:` twins would be a guaranteed source of
 * misses, so the classes stay and what they POINT AT changes instead:
 *
 *   - Each colour that needs a different value in dark mode is emitted as a CSS
 *     variable, per utility family (background / text / border), because the
 *     right dark value depends on the job: `bg-amber-50` is a tint behind text
 *     and must go DARK, while `text-amber-700` is text on that tint and must go
 *     LIGHT. `bg-primary-600` (a button) keeps its colour in both modes.
 *   - Light-mode values are the original hex values, so light mode renders
 *     exactly as it did before this change.
 *   - `data-theme="light"` on an element re-pins the light values for its
 *     subtree — used by previews of the shopper widget, which is always light
 *     whatever the console uses.
 *
 * Values are "R G B" triplets so Tailwind's opacity modifiers (`bg-gray-900/40`)
 * keep working through `rgb(var(--x) / <alpha-value>)`.
 */
import defaultColors from 'tailwindcss/colors.js';

// ---- brand + neutral scales (light values = what the console always used) --
export const primary = {
  50: '#EEF2FF',
  100: '#E0E7FF',
  200: '#C7D2FE',
  300: '#A5B4FC',
  400: '#818CF8',
  500: '#6366F1',
  600: '#4F46E5',
  700: '#4338CA',
  800: '#3730A3',
  900: '#312E81',
  950: '#1E1B4B',
};

export const gray = {
  50: '#F9FAFB',
  100: '#F3F4F6',
  200: '#E5E7EB',
  300: '#D1D5DB',
  400: '#9CA3AF',
  500: '#6B7280',
  600: '#4B5563',
  700: '#374151',
  800: '#1F2937',
  900: '#111827',
  950: '#030712',
};

// ---- dark surfaces --------------------------------------------------------
/** Card / panel surface in dark mode (what `bg-white` becomes). */
const DARK_SURFACE = '#151922';

/** Hand-tuned neutral steps for dark mode, per job. */
const DARK_GRAY = {
  bg: {
    white: DARK_SURFACE,
    50: '#0D1016', // page background, subtle panels
    100: '#1C212B', // hover, chips, segmented controls
    200: '#252B37',
    300: '#313847',
    400: '#4A5263',
    500: '#6B7280',
    600: '#3D4454',
    700: '#2F3542',
    800: '#252A35',
    900: '#1B1F28', // tooltips / inverse chips stay dark, a step off the page
    950: '#0A0C10',
  },
  text: {
    50: '#272C37',
    100: '#363C49',
    200: '#474E5D',
    300: '#5E6677',
    400: '#7D8595',
    500: '#98A0AE',
    600: '#B4BAC5',
    700: '#CDD2DA',
    800: '#E1E4EA',
    900: '#F1F3F6',
    950: '#F8F9FB',
  },
  border: {
    white: DARK_SURFACE,
    50: '#1B2029',
    100: '#212632',
    200: '#2B313E',
    300: '#373E4D',
    400: '#4C5465',
    500: '#646C7C',
    600: '#7D8595',
    700: '#98A0AE',
    800: '#B4BAC5',
    900: '#CDD2DA',
    950: '#E1E4EA',
  },
};

// ---- colour maths ---------------------------------------------------------
function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function triplet(hex) {
  return hexToRgb(hex).join(' ');
}
/** Mix `a` over `b`: t = share of `a`. */
function mix(a, b, t) {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  return (
    '#' +
    A.map((v, i) => Math.round(v * t + B[i] * (1 - t)))
      .map((v) => v.toString(16).padStart(2, '0'))
      .join('')
  );
}

// ---- which hues get dark-mode treatment ----------------------------------
const HUES = [
  'red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'teal', 'cyan',
  'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose',
];

/** Scale lookup for any hue we theme (brand + Tailwind defaults). */
function scaleOf(hue) {
  if (hue === 'primary') return primary;
  return defaultColors[hue];
}

/**
 * Dark value for one (job, hue, step), or undefined when the light value
 * already reads correctly on a dark surface (e.g. a 600 button fill).
 */
function darkValue(job, hue, step) {
  if (hue === 'gray') return DARK_GRAY[job][step];
  if (hue === 'white') return DARK_GRAY[job].white;
  const c = scaleOf(hue);
  if (job === 'bg') {
    // Tints behind text → low-chroma dark tints of the same hue.
    const share = { 50: 0.1, 100: 0.16, 200: 0.24, 300: 0.36 }[step];
    return share ? mix(c[500], DARK_SURFACE, share) : undefined;
  }
  if (job === 'border') {
    const share = { 50: 0.16, 100: 0.22, 200: 0.32, 300: 0.45 }[step];
    return share ? mix(c[500], DARK_SURFACE, share) : undefined;
  }
  // text: deep steps lift to their light counterparts.
  const lift = { 600: 400, 700: 300, 800: 200, 900: 100, 950: 50 }[step];
  return lift ? c[lift] : undefined;
}

const STEPS = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'];
const JOBS = ['bg', 'text', 'border'];

/**
 * Builds { themeColors, lightVars, darkVars }:
 *  - themeColors[job] is the Tailwind colour object for that utility family,
 *    with `rgb(var(--…))` wherever a dark value exists.
 *  - lightVars / darkVars are the CSS custom properties for :root and
 *    :root[data-theme="dark"].
 */
export function buildPalette() {
  const themeColors = { bg: {}, text: {}, border: {} };
  const lightVars = {};
  const darkVars = {};

  for (const job of JOBS) {
    for (const hue of ['gray', 'primary', ...HUES]) {
      const scale = hue === 'gray' ? gray : scaleOf(hue);
      const out = {};
      for (const step of STEPS) {
        const light = scale[step];
        if (!light) continue;
        const dark = darkValue(job, hue, step);
        if (!dark) {
          out[step] = light;
          continue;
        }
        const name = `--c-${job}-${hue}-${step}`;
        lightVars[name] = triplet(light);
        darkVars[name] = triplet(dark);
        out[step] = `rgb(var(${name}) / <alpha-value>)`;
      }
      themeColors[job][hue] = out;
    }
    // white: surfaces flip; `text-white` (on buttons, badges) never does.
    const whiteDark = darkValue(job, 'white');
    if (whiteDark) {
      const name = `--c-${job}-white`;
      lightVars[name] = '255 255 255';
      darkVars[name] = triplet(whiteDark);
      themeColors[job].white = `rgb(var(${name}) / <alpha-value>)`;
    } else {
      themeColors[job].white = '#ffffff';
    }
  }

  // Semantic tokens the shell and new components use directly.
  const semantic = {
    '--st-page': [gray[50], DARK_GRAY.bg[50]],
    '--st-surface': ['#FFFFFF', DARK_SURFACE],
    '--st-surface-2': [gray[50], '#11141B'],
    '--st-sidebar': ['#FFFFFF', '#10131A'],
    '--st-elevated': ['#FFFFFF', '#1A1F29'],
    '--st-border': [gray[200], DARK_GRAY.border[200]],
    '--st-ink': [gray[900], DARK_GRAY.text[900]],
    '--st-ink-2': [gray[600], DARK_GRAY.text[600]],
    '--st-ink-3': [gray[400], DARK_GRAY.text[400]],
    // Chart surfaces (dataviz): grid + axis ink, recessive in both modes.
    '--st-grid': [gray[100], '#232835'],
    '--st-axis': [gray[400], '#7D8595'],
  };
  for (const [name, [l, d]] of Object.entries(semantic)) {
    lightVars[name] = triplet(l);
    darkVars[name] = triplet(d);
  }

  return { themeColors, lightVars, darkVars };
}
