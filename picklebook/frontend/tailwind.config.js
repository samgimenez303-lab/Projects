/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          50: '#f0f5f0',
          100: '#e0eae0',
          200: '#c0d2c4',
          300: '#9cb9a5',
          400: '#6c9580',
          500: '#23483e',
          600: '#1a3d33',
          700: '#13342c',
          800: '#102b25',
          900: '#0e251f',
          950: '#0b211b',
        },
        pickle: {
          50: '#f3f7ec',
          100: '#e7efd9',
          200: '#d6e7b8',
          300: '#bcd98f',
          400: '#9bc56a',
          500: '#4c9254',
          600: '#337140',
          700: '#285c35',
          800: '#244f30',
          900: '#1f4128',
        },
        accent: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
