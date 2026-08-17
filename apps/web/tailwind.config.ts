import type { Config } from 'tailwindcss';

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#090d16',
        surface: {
          50: '#0f172a',
          100: '#131d33',
          200: '#1a2744',
          300: '#243456',
        },
        border: '#1f2d47',
        convey: {
          cyan: '#38bdf8',
          blue: '#2563eb',
          emerald: '#10b981',
          violet: '#a855f7',
          amber: '#f59e0b',
          rose: '#f43f5e',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      animation: {
        'pulse-subtle': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        radar: 'ping 2s cubic-bezier(0, 0, 0.2, 1) infinite',
      },
    },
  },
  plugins: [],
} satisfies Config;
