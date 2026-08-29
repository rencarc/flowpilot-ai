import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        forest: {
          950: "#102116",
          900: "#172d1f",
          800: "#21361e",
          700: "#315f32",
          600: "#438252",
          200: "#dbe5d6",
          100: "#eef4e8",
          50: "#f7f8f3"
        },
        ivory: "#fffffb",
        moss: "#7da35f",
        ambergate: "#9a6a0a",
        riskred: "#a43a2f"
      },
      fontFamily: {
        serif: ["Georgia", "Times New Roman", "serif"]
      },
      boxShadow: {
        soft: "0 18px 50px rgba(37, 64, 32, 0.1)"
      }
    }
  },
  plugins: []
};

export default config;
