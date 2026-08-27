/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        ink: "#17212B",
        canvas: "#F3F6F4",
        paper: "#FFFFFF",
        signal: "#D74F32",
        moss: "#2E6F5E",
        straw: "#E9C46A",
        fog: "#DDE5E1"
      }
    }
  },
  plugins: []
};
