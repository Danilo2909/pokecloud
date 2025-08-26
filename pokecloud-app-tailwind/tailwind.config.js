/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Tema PokeCloud
        'pokecloud': {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1', // primária (índigo)
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81'
        },
        'pcloud-sky': '#38bdf8',     // ciano para nuvem
        'pcloud-sun': '#f59e0b',     // amarelo/alarme
        'pcloud-rose': '#ef4444',    // erro
        'pcloud-emerald': '#10b981', // acerto
      },
      boxShadow: {
        'pcloud': '0 10px 25px -5px rgba(99,102,241,0.25)',
      },
      borderRadius: {
        '2xl': '1.25rem',
      }
    },
  },
  plugins: [],
}
