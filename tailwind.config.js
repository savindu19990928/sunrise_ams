export default {
  content: [
  './index.html',
  './src/**/*.{js,ts,jsx,tsx}'
],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      colors: {
        canvas: '#f4f6f8',
        surface: '#ffffff',
        subtle: '#fafbfc',
        line: '#e4e9ee',
        ink: {
          DEFAULT: '#16202b',
          muted: '#5a6674',
          soft: '#8a95a2',
        },
        brand: {
          50: '#f0faf7',
          100: '#d9f2ea',
          200: '#b0e4d5',
          300: '#7bceb9',
          400: '#45b096',
          500: '#22907a',
          600: '#157163',
          700: '#125b51',
          800: '#114941',
          900: '#0f3c36',
        },
        success: {
          50: '#eefaf1',
          100: '#d5f2df',
          500: '#1c9e5a',
          600: '#157a47',
          700: '#11603a',
        },
        warn: {
          50: '#fff8ea',
          100: '#fdedcd',
          500: '#d98b0b',
          600: '#b06f06',
          700: '#8a5704',
        },
        bill: {
          paper: '#fffcee',
          tint: '#fdf2c4',
          line: '#ecdeb0',
          accent: '#8a5c04',
        },
        danger: {
          50: '#fdf1f0',
          100: '#fadedc',
          500: '#d64545',
          600: '#b32d2d',
          700: '#8f2323',
        },
      },
      boxShadow: {
        card: '0 1px 2px rgba(22, 32, 43, 0.04), 0 1px 3px rgba(22, 32, 43, 0.06)',
        pop: '0 10px 30px rgba(22, 32, 43, 0.12)',
      },
      borderRadius: {
        xl: '0.75rem',
        '2xl': '1rem',
      },
    },
  },
  plugins: [],
}
