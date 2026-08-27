/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        ink: "#F4F4ED",
        canvas: "#121212",
        paper: "#1B1B1B",
        signal: "#D32F2F",
        moss: "#CCFF00",
        straw: "#F3B700",
        fog: "#393939",
        zinc: "#CCFF00",
        muted: "#B7B7AF",
        steel: "#080808"
      },
      fontFamily: {
        heading: ["Impact", "Arial Black", "sans-serif"],
        sans: ["Trebuchet MS", "Verdana", "sans-serif"],
        mono: ["Consolas", "Courier New", "monospace"]
      }
    }
  },
  plugins: [
    ({ addUtilities }) => addUtilities({
      ".bg-ink": { backgroundColor: "#080808" }
    })
  ]
};
