import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'ipl-dark': '#1a1a2e',
        'ipl-card': '#16213e',
        'ipl-border': '#0f3460',
        'ipl-accent': '#e94560',
        'ipl-gold': '#f5a623',
        'ipl-green': '#27ae60',
        'ipl-red': '#e74c3c',
        'ipl-blue': '#3498db',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
} satisfies Config
