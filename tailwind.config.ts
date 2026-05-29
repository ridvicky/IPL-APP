import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'ipl-dark':   '#0d0d1a',
        'ipl-darker': '#080812',
        'ipl-card':   '#141428',
        'ipl-card2':  '#1a1a35',
        'ipl-border': '#1e2a4a',
        'ipl-accent': '#e94560',
        'ipl-gold':   '#f5a623',
        'ipl-green':  '#27ae60',
        'ipl-red':    '#e74c3c',
        'ipl-blue':   '#3498db',
        'ipl-purple': '#9b59b6',
        'ipl-teal':   '#1abc9c',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      backgroundImage: {
        'cricket-pattern': "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.03'%3E%3Ccircle cx='30' cy='30' r='20'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
        'hero-gradient': 'linear-gradient(135deg, #0d0d1a 0%, #1a1235 50%, #0d0d1a 100%)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-right': {
          from: { transform: 'translateX(100%)' },
          to:   { transform: 'translateX(0)' },
        },
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(233,69,96,0)' },
          '50%':      { boxShadow: '0 0 0 8px rgba(233,69,96,0.2)' },
        },
        'hammer': {
          '0%':   { transform: 'rotate(0deg)' },
          '25%':  { transform: 'rotate(-20deg)' },
          '50%':  { transform: 'rotate(0deg)' },
          '75%':  { transform: 'rotate(-20deg)' },
          '100%': { transform: 'rotate(0deg)' },
        },
        'sold-flash': {
          '0%, 100%': { backgroundColor: 'transparent' },
          '50%':      { backgroundColor: 'rgba(39,174,96,0.15)' },
        },
        'bid-pop': {
          '0%':   { transform: 'scale(1.28)', color: '#f5a623' },
          '60%':  { transform: 'scale(1.05)', color: '#f5a623' },
          '100%': { transform: 'scale(1)',    color: 'inherit' },
        },
      },
      animation: {
        'fade-in':       'fade-in 0.3s ease-out',
        'slide-up':      'slide-up 0.4s ease-out',
        'slide-in-right':'slide-in-right 0.25s ease-out',
        'pulse-glow':    'pulse-glow 2s ease-in-out infinite',
        'hammer':        'hammer 1s ease-in-out infinite',
        'sold-flash':    'sold-flash 0.6s ease-in-out',
        'bid-pop':       'bid-pop 0.3s ease-out',
      },
      boxShadow: {
        'glow-accent': '0 0 20px rgba(233,69,96,0.3)',
        'glow-gold':   '0 0 20px rgba(245,166,35,0.3)',
        'glow-green':  '0 0 20px rgba(39,174,96,0.3)',
        'card':        '0 4px 24px rgba(0,0,0,0.4)',
      },
    },
  },
  plugins: [],
} satisfies Config
