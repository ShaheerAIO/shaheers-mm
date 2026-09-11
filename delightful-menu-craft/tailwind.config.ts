import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ['Poppins', 'IBM Plex Sans', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'IBM Plex Mono', 'Fira Code', 'monospace'],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          bg: "hsl(var(--sidebar-bg))",
          foreground: "hsl(var(--sidebar-foreground))",
          active: "hsl(var(--sidebar-active))",
          hover: "hsl(var(--sidebar-hover))",
        },
        panel: {
          bg: "hsl(var(--panel-bg))",
          border: "hsl(var(--panel-border))",
        },
        column: {
          minimized: "hsl(var(--column-minimized))",
          active: "hsl(var(--column-active))",
          header: "hsl(var(--column-header))",
        },
        item: {
          hover: "hsl(var(--item-hover))",
          selected: "hsl(var(--item-selected))",
          "86": "hsl(var(--item-86))",
        },
        success: "hsl(var(--success))",
        warning: "hsl(var(--warning))",
        info: "hsl(var(--info))",
        // AIO raw tokens — surface tiers, rules and status washes that the
        // shadcn slots have no equivalent for.
        surface: {
          DEFAULT: "var(--aio-surface)",
          2: "var(--aio-surface-2)",
          3: "var(--aio-surface-3)",
        },
        rule: {
          DEFAULT: "var(--aio-rule)",
          2: "var(--aio-rule-2)",
        },
        ink: {
          DEFAULT: "var(--aio-text)",
          2: "var(--aio-text-2)",
          muted: "var(--aio-muted)",
          faint: "var(--aio-text-faint)",
        },
        accent2: {
          DEFAULT: "var(--aio-accent-2)",
          soft: "var(--aio-accent-2-soft)",
        },
        ok: {
          DEFAULT: "var(--aio-ok)",
          bg: "var(--aio-ok-bg)",
          edge: "var(--aio-ok-edge)",
        },
        warn: {
          DEFAULT: "var(--aio-warn)",
          bg: "var(--aio-warn-bg)",
          edge: "var(--aio-warn-edge)",
        },
        danger: {
          DEFAULT: "var(--aio-danger)",
          bg: "var(--aio-danger-bg)",
          edge: "var(--aio-danger-edge)",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        pill: "999px",
        btn: "var(--aio-r-btn)",
        chip: "var(--aio-r-chip)",
      },
      boxShadow: {
        sm: "var(--aio-shadow-sm)",
        DEFAULT: "var(--aio-shadow-sm)",
        md: "var(--aio-shadow-md)",
        lg: "var(--aio-shadow-lg)",
        pop: "var(--aio-shadow-pop)",
      },
      transitionTimingFunction: {
        aio: "cubic-bezier(0.4, 0, 0.2, 1)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "slide-in-right": {
          from: { transform: "translateX(100%)", opacity: "0" },
          to: { transform: "translateX(0)", opacity: "1" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "slide-in-right": "slide-in-right 0.3s ease-out",
        "fade-in": "fade-in 0.2s ease-out",
      },
      spacing: {
        "sidebar": "60px",
        "right-panel": "388px",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
