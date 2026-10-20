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
        app: {
          bg: 'var(--color-app-bg)',
          surface: 'var(--color-app-surface)',
          card: 'var(--color-app-card)',
          'card-hover': 'var(--color-app-card-hover)',
          border: 'var(--color-app-border)',
          'border-subtle': 'var(--color-app-border-subtle)',
          'text-main': 'var(--color-text-main)',
          'text-muted': 'var(--color-text-muted)',
          'text-dim': 'var(--color-text-dim)',
          code: 'var(--color-code-bg)',
        }
      }
    },
  },
  plugins: [],
}
