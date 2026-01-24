import type { Config } from "tailwindcss";

const config: Config = {
    darkMode: "class",
    content: [
        "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            colors: {
                background: "var(--background)",
                foreground: "var(--foreground)",
                "primary": "#8702cf",
                "primary-dark": "#7002ad", // inferred darker shade
                "background-light": "#f7f5f8",
                "background-dark": "#1c0f23",
            },
            fontFamily: {
                "display": [
                    "var(--font-noto-sans-kr)",
                    "var(--font-inter)",
                    "ui-sans-serif",
                    "system-ui",
                    "-apple-system",
                    "\"Segoe UI\"",
                    "Arial",
                    "\"Apple SD Gothic Neo\"",
                    "\"Malgun Gothic\"",
                    "sans-serif",
                ],
            },
            borderRadius: {
                "lg": "1rem",
                "xl": "1.5rem",
                "2xl": "2rem",
            },
        },
    },
    plugins: [],
};
export default config;
