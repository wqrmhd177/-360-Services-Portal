import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: 'class',
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      colors: {
        portal: {
          50: "#C1E8FF",
          100: "#B0E0FC",
          200: "#7DA0CA",
          300: "#6B94C4",
          400: "#5483B3",
          500: "#5483B3",
          600: "#052659",
          700: "#052659",
          800: "#021024",
          900: "#021024",
          950: "#021024",
        },
        brand: {
          50: "#f7ffcc",
          100: "#eeff99",
          200: "#e5ff66",
          300: "#dcff33",
          400: "#d3ff00",
          500: "#DFFF00",
          600: "#ccff00",
          700: "#b3e600",
          800: "#99cc00",
          900: "#7fb300"
        },
        gray: {
          50: "#F7F7F7", // Very light gray background
          100: "#F0F0F0",
          200: "#E0E0E0",
          300: "#D0D0D0",
          400: "#AAAAAA", // Secondary text
          500: "#888888",
          600: "#666666",
          700: "#444444",
          800: "#2A2A2A",
          900: "#1A1A1A" // Dark contrast
        }
      },
      borderRadius: {
        'xl': '1rem',
        '2xl': '1.5rem',
        '3xl': '2rem',
      },
      boxShadow: {
        'soft': '0 2px 8px rgba(0, 0, 0, 0.08)',
        'card': '0 4px 12px rgba(0, 0, 0, 0.1)',
      }
    }
  },
  plugins: []
};

export default config;

