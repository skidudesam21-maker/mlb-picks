/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Lighter grey canvas with a slight warm cast
        bg: {
          950: "#17191c",   // page background
          900: "#1c1f23",   // card interior
          800: "#24282d",   // elevated card
          700: "#2e333a",   // hover / border-strong
          600: "#3c424a",   // subtle border
          500: "#525963",   // muted text
          400: "#7a818c",   // secondary text
        },
        paper: {
          100: "#e4e6ea",   // primary text
          200: "#c9ccd2",   // body text
          300: "#a5a9b2",   // meta text
        },
        // Lighter warm red accents
        red: {
          300: "#ff8b8b",   // hover
          400: "#ff6b6b",   // primary accent
          500: "#ef4f4f",   // strong
          600: "#d93a3a",   // loss indicator
        },
        // Kept subtle so red stays dominant
        good: {
          400: "#7ab87a",   // muted win green
          500: "#5ea45e",
        },
      },
      fontFamily: {
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        card: "0 1px 0 rgba(255,255,255,0.03) inset, 0 4px 20px -8px rgba(0,0,0,0.4)",
        "card-lift": "0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 28px -12px rgba(0,0,0,0.5)",
        "red-glow": "0 0 0 1px rgba(255,107,107,0.5), 0 8px 28px -12px rgba(255,107,107,0.25)",
      },
    },
  },
  plugins: [],
};
