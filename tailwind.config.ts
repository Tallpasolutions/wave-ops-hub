import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const config: Config = {
  darkMode: ["class"], // exigido pelo shadcn mesmo em dark-only; sem efeito visual (nunca toggled)
  content: [
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        body: ["var(--font-body)"],
        display: ["var(--font-display)"],
        mono: ["var(--font-mono)"],
      },
      colors: {
        /* shadcn semantic — referenciam as vars shadcn (que apontam pros tokens Tallpa) */
        background: "var(--background)",
        foreground: "var(--foreground)",
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        /* Tallpa raw — mantidos para uso direto em componentes customizados */
        "bg-1": "var(--bg-1)",
        "bg-2": "var(--bg-2)",
        line: "var(--line)",
        "line-strong": "var(--line-strong)",
        text: "var(--text)",
        "text-2": "var(--text-2)",
        "text-3": "var(--text-3)",
        cyan: "var(--cyan)",
        blue: "var(--blue)",
        green: "var(--green)",
        amber: "var(--amber)",
        red: "var(--red)",
      },
      backgroundImage: {
        grad: "var(--grad)",
        "grad-soft": "var(--grad-soft)",
      },
      boxShadow: {
        "glow-cyan": "var(--shadow-glow-cyan)",
        card: "var(--shadow-card)",
      },
      borderRadius: {
        // shadcn padrão — relação proporcional interna esperada por componentes shadcn
        lg: "var(--radius)", // 10px
        md: "calc(var(--radius) - 2px)", // 8px
        sm: "calc(var(--radius) - 4px)", // 6px
        // Tallpa específico — nomes não conflitantes para componentes customizados
        "tallpa-sm": "var(--radius-sm)", // 6px
        "tallpa-md": "var(--radius-md)", // 10px
        "tallpa-lg": "var(--radius-lg)", // 14px
        "tallpa-xl": "var(--radius-xl)", // 16px
        "tallpa-full": "var(--radius-full)", // 999px
      },
      spacing: {
        1: "4px",
        2: "8px",
        3: "12px",
        4: "16px",
        5: "20px",
        6: "24px",
        7: "28px",
        8: "32px",
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;
