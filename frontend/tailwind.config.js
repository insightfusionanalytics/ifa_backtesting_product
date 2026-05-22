/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        ink: {
          50:  '#f7f7f8',
          100: '#eeeef1',
          200: '#d9d9e0',
          300: '#b7b7c2',
          400: '#8a8a98',
          500: '#5f5f6e',
          600: '#404049',
          700: '#2c2c34',
          800: '#1c1c22',
          900: '#111115',
          950: '#0a0a0d',
        },
        accent: {
          50:  '#eef0ff',
          100: '#dde1ff',
          200: '#bcc4ff',
          300: '#94a0ff',
          400: '#6c7aff',
          500: '#4f5cf5',
          600: '#3f47d6',
          700: '#3036ad',
          800: '#262a83',
          900: '#1c1f5e',
        },
      },
      boxShadow: {
        'card': '0 1px 2px 0 rgb(17 17 21 / 0.04), 0 1px 1px 0 rgb(17 17 21 / 0.02)',
        'pop':  '0 8px 28px -8px rgb(17 17 21 / 0.18), 0 2px 6px -2px rgb(17 17 21 / 0.06)',
      },
      // Used by the sidebar morph in Layout.tsx — when the override panel
      // swaps in (or out) we crossfade rather than hard-cutting.
      keyframes: {
        fadeIn: {
          '0%':   { opacity: '0', transform: 'translateY(-2px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        fadeIn: 'fadeIn 200ms ease-out',
      },
    },
  },
  plugins: [],
};
