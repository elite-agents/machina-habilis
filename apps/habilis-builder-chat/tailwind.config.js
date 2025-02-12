/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        dark: {
          100: '#121212',
          200: '#1a1a1a',
          300: '#2a2a2a',
          400: '#3a3a3a',
        }
      }
    },
  },
  plugins: [],
} 