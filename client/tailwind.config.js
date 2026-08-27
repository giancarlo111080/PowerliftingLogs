/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        ink: "rgb(var(--if-ink) / <alpha-value>)",
        canvas: "rgb(var(--if-canvas) / <alpha-value>)",
        paper: "rgb(var(--if-paper) / <alpha-value>)",
        signal: "rgb(var(--if-signal) / <alpha-value>)",
        moss: "rgb(var(--if-moss) / <alpha-value>)",
        straw: "rgb(var(--if-straw) / <alpha-value>)",
        fog: "rgb(var(--if-fog) / <alpha-value>)",
        zinc: "rgb(var(--if-zinc) / <alpha-value>)",
        muted: "rgb(var(--if-muted) / <alpha-value>)",
        steel: "rgb(var(--if-steel) / <alpha-value>)"
      },
      fontFamily: {
        heading: ["Barlow Condensed", "Arial Narrow", "Segoe UI", "sans-serif"],
        sans: ["Nunito", "Aptos", "Segoe UI", "sans-serif"],
        serif: ["Nunito", "Aptos", "Segoe UI", "sans-serif"],
        mono: ["Roboto Mono", "Cascadia Mono", "Consolas", "monospace"]
      }
    }
  },
  plugins: [
    ({ addUtilities }) => addUtilities({
      ".bg-ink": { backgroundColor: "rgb(var(--if-steel) / 1)" }
    })
  ]
};
