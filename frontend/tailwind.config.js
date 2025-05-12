/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'vibe-green': '#1DB954',
        'vibe-dark': '#1A1A1A',
        'vibe-gray': '#B3B3B3',
      },
      fontFamily: {
        'montserrat': ['Montserrat', 'sans-serif'],
      },
    },
  },
  plugins: [],
}