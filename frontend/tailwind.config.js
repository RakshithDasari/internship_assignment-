/** Design tokens: brand colours and fonts. */
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        cinema: { void: "#0B0707", surface: "#140D0D", border: "rgba(255, 255, 255, 0.12)" },
        scarlet: { DEFAULT: "#E53935", dark: "#B71C1C", glow: "#FF5252" },
        crimson: { DEFAULT: "#9E1F1F", deep: "#6B1E1E", subtle: "rgba(158, 31, 31, 0.18)" },
        success: { DEFAULT: "#385A28", glow: "#507D3A", subtle: "rgba(80, 125, 58, 0.20)" },
        detect: { white: "#FFFFFF", red: "#E53935", slate: "#CBD5E1", zinc: "#94A3B8", ash: "#64748B" },
      },
      fontFamily: {
        // next/font exposes the self-hosted fonts as CSS variables (see app/layout.jsx).
        headline: ["var(--font-bebas)", "var(--font-sans)", "-apple-system", "sans-serif"],
        body: ["var(--font-sans)", "-apple-system", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      borderRadius: {
        "apple-sm": "8px",
        "apple-md": "12px",
        "apple-lg": "16px",
        "apple-xl": "22px",
        "apple-2xl": "28px",
        "apple-pill": "9999px",
      },
      boxShadow: {
        "dark-glass": "0 24px 64px -12px rgba(0, 0, 0, 0.90), inset 0 1px 1.5px 0 rgba(255, 255, 255, 0.18)",
        "dark-card": "0 8px 32px 0 rgba(0, 0, 0, 0.50), inset 0 1px 1px 0 rgba(255, 255, 255, 0.12)",
        "red-glow": "0 0 25px rgba(229, 57, 53, 0.35)",
      },
    },
  },
  plugins: [],
};
