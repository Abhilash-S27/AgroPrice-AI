/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // AgroPrice AI brand palette — earth + growth tones
        primary: {
          50:  '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',   // primary green
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
        },
        // RP-10: Deep intelligence forest green palette
        forest: {
          50:  '#f0f9f4',
          100: '#dceee5',
          200: '#b9decb',
          300: '#8cc5a9',
          400: '#5aa582',
          500: '#3a8766',
          600: '#2a6b50',
          700: '#1f513f',
          800: '#1b4332',
          900: '#163a2d',
          950: '#0d2118',
        },
        agro: {
          soil:   '#92400e',   // brown
          wheat:  '#d97706',   // amber
          sky:    '#0284c7',   // blue
          harvest:'#65a30d',   // lime green
        },
      },
      backdropBlur: {
        xs: '2px',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui'],
        mono: ['JetBrains Mono', 'ui-monospace'],
      },
    },
  },
  plugins: [],
}
