// Tailwind v3 config file
export default {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: ["class"],
  theme: {
    container: {
      center: true,
      screens: {
        sm: "640px",
        md: "768px",
        lg: "1024px",
        xl: "1280px",
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        // shadcn tokens
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",

        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },

        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },

        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",

          // CPMSL brand scale
          50: "#F0F4F7",
          100: "#D9E3EA",
          200: "#B3C7D5",
          300: "#8DABC0",
          400: "#6B8FA8",
          500: "#5A7085",
          600: "#4A5D6E",
          700: "#3A4A57",
          800: "#2A3740",
          900: "#1A242A",
        },

        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",

          // CPMSL brand scale
          50: "#FAF8F3",
          100: "#F0EBDF",
          200: "#E0D6BF",
          300: "#D1C19F",
          400: "#C3B594",
          500: "#B0A07A",
          600: "#9A8A65",
          700: "#7A6E50",
          800: "#5A523C",
          900: "#3A3628",
        },

        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },

        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },

        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },

        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",

        "chart-1": "hsl(var(--chart-1))",
        "chart-2": "hsl(var(--chart-2))",
        "chart-3": "hsl(var(--chart-3))",
        "chart-4": "hsl(var(--chart-4))",
        "chart-5": "hsl(var(--chart-5))",

        sidebar: {
          DEFAULT: "hsl(var(--sidebar))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },

        neutral: {
          50: "#FAFAF8",
          100: "#F5F4F2",
          200: "#E8E6E3",
          300: "#D1CECC",
          400: "#A8A5A2",
          500: "#78756F",
          600: "#5C5955",
          700: "#403D3A",
          800: "#2A2725",
          900: "#1E1A17",
        },

        // Jeu d'etats normatif (DESIGN.md). Quatre roles, quatre pas chacun :
        //   DEFAULT = le plein et l'icone · soft = la surface
        //   border  = le filet 1 px       · ink  = le texte
        // `ink` est un pas de rampe, pas une couleur de marque nouvelle : meme
        // mecanisme que `destructif`, qui est `erreur` un pas plus profond.
        success: {
          DEFAULT: "#2D7D46", // 4,87:1 sur papier creme
          soft: "#E8F5EC",
          border: "#8DB099",
          ink: "#1E5C33", // 7,65:1 sur papier, 7,10:1 sur soft
          foreground: "#FAFAFA", // 4,87:1 sur le plein
        },

        warning: {
          DEFAULT: "#C48B1A", // 2,86:1 : plein uniquement, jamais du texte
          soft: "#FEF6E0",
          border: "#CAB383",
          ink: "#8A6212", // 5,25:1 sur papier, 5,08:1 sur soft
          foreground: "#2A1B02", // 5,62:1 sur le plein — le blanc y echoue a 2,85:1
        },

        error: {
          DEFAULT: "#C43C3C", // 4,96:1 sur papier
          soft: "#FDE8E8",
          border: "#CC9393",
          ink: "#8F2B2B", // 7,90:1 sur papier, 7,02:1 sur soft
          foreground: "#FAFAFA", // 4,96:1 sur le plein
        },

        info: {
          DEFAULT: "#2B6CB0", // 5,20:1 sur papier
          soft: "#E3EFF9",
          border: "#8AA7C3",
          ink: "#1E4E80", // 8,20:1 sur papier, 7,32:1 sur soft
          foreground: "#FAFAFA", // 5,19:1 sur le plein
        },
      },

      borderColor: {
        DEFAULT: "hsl(var(--border))",
      },

      // L'echelle de Tailwind par defaut (12/14/16/18/20/24/30/36) n'etait pas
      // celle de DESIGN.md (12/13/15/18/22/28/36) : deux echelles tournaient en
      // parallele, et `text-base` (16 px) etait plus gros que le corps de page
      // (15 px). Les utilitaires pointent desormais sur les jetons --text-*,
      // seule echelle du systeme. Chaque pas porte son interlignage de role.
      // Chaque pas porte l'interlignage ET l'approche de son role. Sans quoi
      // `text-xs` et `text-sm` ne se distinguaient que par 1 px : l'approche
      // qui les separe (+0.03em contre +0.02em) ne vivait que dans les sept
      // classes de role, employees 67 fois contre 851 utilitaires bruts.
      fontSize: {
        "3xs": ["var(--text-3xs)", { lineHeight: "1.3",  letterSpacing: "0" }],       // 10 px — grille dense
        "2xs": ["var(--text-2xs)", { lineHeight: "1.3",  letterSpacing: "0" }],       // 11 px — grille dense
        xs:    ["var(--text-xs)",   { lineHeight: "var(--leading-normal)",  letterSpacing: "0.03em" }],  // 12 px — legende
        sm:    ["var(--text-sm)",   { lineHeight: "1.4",  letterSpacing: "0.02em" }], // 13 px — libelle, controle
        base:  ["var(--text-base)", { lineHeight: "var(--leading-body)", letterSpacing: "0" }],      // 15 px — corps
        lg:    ["var(--text-lg)",   { lineHeight: "1.4",  letterSpacing: "-0.01em" }],// 18 px — sous-titre
        xl:    ["var(--text-xl)",   { lineHeight: "1.25", letterSpacing: "-0.02em" }],// 22 px — titre
        "2xl": ["var(--text-2xl)",  { lineHeight: "var(--leading-snug)",  letterSpacing: "-0.025em" }], // 28 px — chapeau
        "3xl": ["var(--text-3xl)",  { lineHeight: "var(--leading-tight)", letterSpacing: "-0.03em" }],  // 36 px — display
      },

      fontFamily: {
        sans: "var(--font-sans)",
        serif: "var(--font-serif)",
        mono: "var(--font-mono)",
      },

      borderRadius: {
        sm: "calc(var(--radius) - 4px)",
        md: "calc(var(--radius) - 2px)",
        lg: "var(--radius)",
        xl: "calc(var(--radius) + 4px)",
        "2xl": "calc(var(--radius) + 8px)",
      },

      boxShadow: {
        "2xs": "var(--shadow-2xs)",
        xs: "var(--shadow-xs)",
        sm: "var(--shadow-sm)",
        DEFAULT: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
        xl: "var(--shadow-xl)",
        "2xl": "var(--shadow-2xl)",
        none: "0 0 #0000",
      },

      keyframes: {
        "slide-from-left": {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(0)" },
        },
        "slide-to-left": {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-100%)" },
        },
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },

      animation: {
        "slide-from-left":
          "slide-from-left 0.3s cubic-bezier(0.82, 0.085, 0.395, 0.895)",
        "slide-to-left":
          "slide-to-left 0.25s cubic-bezier(0.82, 0.085, 0.395, 0.895)",
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};