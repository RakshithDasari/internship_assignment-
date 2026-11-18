/** Design tokens: brand colours and fonts. */
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Theme-aware: `white` is the text/line colour, `black` the backdrop (see globals.css).
        white: "rgb(var(--ink) / <alpha-value>)",
        black: "rgb(var(--paper) / <alpha-value>)",
        scarlet: { DEFAULT: "#E53935", dark: "#B71C1C" },
        success: { DEFAULT: "#385A28", glow: "#507D3A" },
      },
      fontFamily: {
        // next/font exposes the self-hosted fonts as CSS variables (see app/layout.jsx).
        headline: ["var(--font-bebas)", "var(--font-sans)", "-apple-system", "sans-serif"],
        body: ["var(--font-sans)", "-apple-system", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
    },
  },
  plugins: [],
};
