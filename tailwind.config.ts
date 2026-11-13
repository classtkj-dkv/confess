import type { Config } from "tailwindcss";

// Token warna memakai channel RGB agar modifier opacity (mis. bg-ink/5,
// text-ink/90, bg-surface/60) berfungsi di dark maupun light mode.
const token = (name: string) => `rgb(var(${name}) / <alpha-value>)`;

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: ["class", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        primary: "#4F6BFF",
        secondary: "#7C5CFF",
        background: token("--c-bg"),
        surface: token("--c-surface"),
        card: token("--c-card"),
        ink: token("--c-text"),
        muted: token("--c-muted"),
        hairline: "var(--c-border)",
        danger: "#F0506E",
        success: "#2FBF8F",
        warning: "#F5A524",
      },
      spacing: {
        "18": "4.5rem",
        "88": "22rem",
      },
      boxShadow: {
        soft: "var(--shadow-soft)",
        lift: "var(--shadow-lift)",
        glow: "0 1px 2px rgba(0,0,0,0.12)",
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.25rem",
        "3xl": "1.75rem",
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
