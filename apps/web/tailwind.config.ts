import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        violet: {
          DEFAULT: "#6D4AFF",
          50: "#F1EDFF",
          100: "#E3DBFF",
          500: "#6D4AFF",
          700: "#4B2FD1",
        },
        lime: {
          DEFAULT: "#B8F13B",
          100: "#EDFBC6",
          500: "#B8F13B",
          700: "#8CC215",
        },
        ink: "#14112B",
        mist: "#F4F2FF",
      },
      fontFamily: {
        display: ["var(--font-display)", "Inter", "sans-serif"],
        sans: ["var(--font-sans)", "Inter", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      borderRadius: {
        chip: "12px",
        input: "20px",
        card: "28px",
      },
      boxShadow: {
        glass: "0 8px 32px rgba(109, 74, 255, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.8)",
        "glass-hover": "0 18px 44px rgba(109, 74, 255, 0.20), inset 0 1px 0 rgba(255, 255, 255, 0.9)",
        "lime-glow": "0 8px 28px rgba(184, 241, 59, 0.45)",
      },
    },
  },
  plugins: [],
};

export default config;

