/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        premium: {
          bg: '#0f172a',
          card: '#1e293b',
          text: '#f8fafc',
          accent: '#38bdf8',
        }
      }
    },
  },
  plugins: [],
}
