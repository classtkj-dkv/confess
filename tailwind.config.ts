import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: ["class", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        primary: "#2563EB",
        secondary: "#4F46E5",
        background: "var(--c-bg)",
        surface: "var(--c-surface)",
        card: "var(--c-card)",
        ink: "var(--c-text)",
        muted: "var(--c-muted)",
        hairline: "var(--c-border)",
        danger: "#EF4444",
        success: "#22C55E",
        warning: "#F59E0B",
      },
      spacing: {
        "18": "4.5rem",
        "88": "22rem",
      },
      boxShadow: {
        soft: "0 8px 24px rgba(2,6,23,0.35)",
        lift: "0 12px 32px rgba(2,6,23,0.45)",
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.25rem",
      },
      fontFamily: {
        sans: [
          "var(--font-inter, system-ui)",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
      transitionDuration: {
        DEFAULT: "200ms",
      },
    },
  },
  plugins: [],
};

export default config;
