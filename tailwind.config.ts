import type { Config } from "tailwindcss";

export default {
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: "#6263A6",
        secondary: "#120621",
        terciary: "#1E1330",
        borderColor: "#251936",
        brandColor: "#241F6F",
      },
      height: {
        "calc-header-screen": "calc(100vh - 90px)",
      },
      keyframes: {
        "pulse-once": {
          "0%, 100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.05)" },
        },
        reveal: {
          "0%": { opacity: "0", filter: "blur(10px)" },
          "100%": { opacity: "1", filter: "blur(0)" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        fadeOut: {
          "0%": { opacity: "0.6" },
          "100%": { opacity: "0" },
        },
      },
      animation: {
        "pulse-once": "pulse-once 2s ease-in-out",
        reveal: "reveal 1s ease-in-out",
        fadeIn: "fadeIn 0.5s ease-in-out",
        fadeOut: "fadeOut 5s ease-in-out forwards",
      },
    },
  },
  plugins: [],
} satisfies Config;
