/**
 * Brand colours follow the main Techsters site (theme colour #1bb0ce).
 * All colours are CSS variables (see src/index.css) so light/dark mode is a single switch.
 * To retune the palette, change the variables in index.css, not the components.
 */
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;
const scale = (p, steps) => Object.fromEntries(steps.map((s) => [s, v(`${p}-${s}`)]));

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: scale('brand', [50, 100, 200, 300, 400, 500, 600, 700, 800, 900]),
        ink: { DEFAULT: v('ink-900'), ...scale('ink', [50, 100, 200, 300, 400, 500, 600, 700, 800, 900]) },
        surface: v('surface'),
        night: '#071a22', // always-dark surface (footer, toasts, dark buttons) in both themes
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['"Instrument Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      borderRadius: { DEFAULT: '8px', lg: '12px', xl: '16px' },
      boxShadow: {
        card: '0 1px 2px rgb(var(--shadow) / .05), 0 0 0 1px rgb(var(--ring) / var(--ring-a))',
        pop: '0 16px 40px -8px rgb(var(--shadow) / .28), 0 0 0 1px rgb(var(--ring) / var(--ring-a))',
      },
    },
  },
  plugins: [],
};
