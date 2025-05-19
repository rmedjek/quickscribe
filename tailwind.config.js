// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      animation: {
        'spin-slow': 'spin 3s linear infinite',
        'barberpole': 'barberpole 1s linear infinite', // Add this
      },
      keyframes: { // Add this
        barberpole: {
          'from': { backgroundPosition: '0 0' },
          'to': { backgroundPosition: '40px 0' },
        }
      }
    },
  },
}