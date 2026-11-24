/** Brand: #0260FF (primary) and #0E0E0E (ink) are taken from the original Techsters logo. */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#EEF4FF', 100: '#DCE8FF', 200: '#B9D0FF', 300: '#8AB0FF', 400: '#4F85FF',
          500: '#1B6AFF', 600: '#0260FF', 700: '#014DD1', 800: '#0A3FA3', 900: '#0C327A',
        },
        ink: { DEFAULT: '#0E0E0E', 900: '#0E0E0E', 800: '#1B1D22', 700: '#2E3139', 600: '#4A4E59', 500: '#6B7080', 400: '#9498A6', 300: '#C3C6D0', 200: '#E1E3EA', 100: '#EEF0F5', 50: '#F6F7FA' },
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['"Instrument Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      borderRadius: { DEFAULT: '8px', lg: '12px', xl: '16px' },
      boxShadow: {
        card: '0 1px 2px rgba(14,14,14,.04), 0 0 0 1px rgba(14,14,14,.06)',
        pop: '0 12px 32px -8px rgba(14,14,14,.18), 0 0 0 1px rgba(14,14,14,.06)',
      },
    },
  },
  plugins: [],
};
