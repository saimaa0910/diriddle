import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: '#090B0F',
        surface: '#12161D',
        card: '#191F28',
        'card-hover': '#202733',
        border: '#262D37',
        accent: '#FF8A45',
        'accent-hover': '#FF9D63',
        'text-primary': '#F5F7FA',
        'text-secondary': '#929BA8',
        'text-muted': '#636C7A',
        success: '#22C55E',
        warning: '#F59E0B',
        danger: '#EF4444',
        info: '#3B82F6',
      },
      borderRadius: {
        card: '14px',
        panel: '16px',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
