/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
    './contexts/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        accent: {
          warm: '#F59E0B',
          'warm-light': '#FBBF24',
          'warm-dark': '#D97706',
          rose: '#EC4899',
          indigo: '#6366F1',
        },
        mood: {
          happy: '#22C55E',
          calm: '#06B6D4',
          sad: '#6366F1',
          angry: '#EF4444',
          anxious: '#F59E0B',
          tired: '#8B5CF6',
          excited: '#EC4899',
          neutral: '#64748B',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          secondary: '#F8FAFC',
          muted: '#F1F5F9',
        },
      },
    },
  },
  plugins: [],
};
