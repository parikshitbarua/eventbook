/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  safelist: [
    // Progress bar colors for LoadingModal
    'bg-blue-600',
    'bg-green-600', 
    'bg-purple-600',
    'bg-orange-600',
    'bg-red-600',
    'bg-gray-600',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
