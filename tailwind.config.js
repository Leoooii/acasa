/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: "#0b0b0e",
          elevated: "#15151b",
          card: "#1c1c24",
        },
        border: {
          DEFAULT: "#2a2a35",
        },
        text: {
          DEFAULT: "#f4f4f6",
          muted: "#9a9aa8",
          dim: "#6b6b78",
        },
        accent: {
          DEFAULT: "#7c5cff",
          soft: "#3a2c8a",
        },
      },
    },
  },
  plugins: [],
};
