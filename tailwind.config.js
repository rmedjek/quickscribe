// tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      animation: {
        "spin-slow": "spin 3s linear infinite",
        barberpole: "barberpole 1s linear infinite",
        shimmer: "shimmer 2s linear infinite",
      },
      keyframes: {
        barberpole: {
          from: { backgroundPosition: "0 0" },
          to:   { backgroundPosition: "40px 0" },
        },
      shimmer: {
          "0%": { "background-position": "-100% 0" },
          "100%": { "background-position": "100% 0" },
        },  
      },
    },
  },
  plugins: [],
};