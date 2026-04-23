/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#07090b",
          900: "#0b0e12",
          800: "#11161c",
          700: "#1a212a",
          600: "#2a333f",
        },
        gold: {
          400: "#e8c26a",
          500: "#d4a73d",
          600: "#b8891f",
        },
        turf: {
          400: "#4ade80",
          500: "#22c55e",
          600: "#16a34a",
          700: "#15803d",
        },
        blood: {
          500: "#ef4444",
          600: "#dc2626",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "serif"],
        sans: ["var(--font-body)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      boxShadow: {
        gold: "0 0 40px -10px rgba(212, 167, 61, 0.4)",
        card: "0 4px 24px -8px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255,255,255,0.04)",
      },
    },
  },
  plugins: [],
};
