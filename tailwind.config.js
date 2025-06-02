// tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}", // This is key!
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      animation: {
        'spin-slow': 'spin 3s linear infinite',
        'barberpole': 'barberpole 1s linear infinite',
      },
      keyframes: {
        barberpole: {
          'from': { backgroundPosition: '0 0' },
          'to': { backgroundPosition: '40px 0' },
        }
      }
    },
  },
  plugins: [],
};