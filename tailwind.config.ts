import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#1C3A2F",
          foreground: "#FAF8F4",
        },
        background: "#FAF8F4",
        foreground: "#111827",
        accent: {
          DEFAULT: "#C4954A",
          foreground: "#FFFFFF",
        },
      },
      fontFamily: {
        sans: ["var(--font-dm-sans)"],
        serif: ["var(--font-cormorant-garamond)"],
        hand: ["var(--font-caveat)", "cursive"],
      },
    },
  },
  plugins: [require('@tailwindcss/forms')],
};
export default config;
