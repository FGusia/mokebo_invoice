/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        mokebo: {
          dark: "#2B2E34",
          surface: "#33373E",
          surface2: "#3B4048",
          border: "#454B54",
          fg: "#F2F1EC",
          muted: "#A9AEB8",
          green: "#425849",
          mint: "#D9E8C3",
          mintdark: "#B9D49C",
          blush: "#EDBEBB",
          blue: "#215070",
          lightblue: "#D7DFF0",
          olive: "#766325",
          cream: "#E8E0C1",
          rust: "#6F331D",
        },
      },
      fontFamily: {
        sans: ["Manrope", "ui-sans-serif", "system-ui", "sans-serif"],
        serif: ['"Source Serif 4"', "ui-serif", "serif"],
        brand: ['"Baloo 2"', "ui-sans-serif", "sans-serif"],
        mono: ["DM Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
    },
  },
  plugins: [],
};
