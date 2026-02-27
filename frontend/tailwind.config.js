/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'nexus-primary': 'rgb(var(--nexus-primary) / <alpha-value>)',
        'nexus-secondary': 'rgb(var(--nexus-secondary) / <alpha-value>)',
        'nexus-accent': 'rgb(var(--nexus-accent) / <alpha-value>)',
        'nexus-surface': 'rgb(var(--nexus-surface) / <alpha-value>)',
        'nexus-bg': 'rgb(var(--nexus-bg) / <alpha-value>)',
        'nexus-card': 'rgb(var(--nexus-card) / <alpha-value>)',
        'nexus-border': 'rgb(var(--nexus-border) / <alpha-value>)',
        'nexus-text': 'rgb(var(--nexus-text) / <alpha-value>)',
        'nexus-muted': 'rgb(var(--nexus-muted) / <alpha-value>)',
        'nexus-success': 'rgb(var(--nexus-success) / <alpha-value>)',
        'nexus-warning': 'rgb(var(--nexus-warning) / <alpha-value>)',
        'nexus-error': 'rgb(var(--nexus-error) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      animation: {
        'glow': 'glow 2s ease-in-out infinite alternate',
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 6s ease-in-out infinite',
        'slide-in': 'slideIn 0.3s ease-out',
        'fade-in': 'fadeIn 0.4s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'spin-slow': 'spin 3s linear infinite',
        'shimmer': 'shimmer 2s linear infinite',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px rgb(var(--nexus-primary) / 0.5), 0 0 20px rgb(var(--nexus-primary) / 0.2)' },
          '100%': { boxShadow: '0 0 20px rgb(var(--nexus-primary) / 0.8), 0 0 60px rgb(var(--nexus-primary) / 0.4)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        slideIn: {
          '0%': { transform: 'translateX(-100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.9)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
      boxShadow: {
        'nexus': '0 0 15px rgb(var(--nexus-primary) / 0.3)',
        'nexus-lg': '0 0 30px rgb(var(--nexus-primary) / 0.4)',
        'nexus-violet': '0 0 15px rgb(var(--nexus-secondary) / 0.3)',
      },
    },
  },
  plugins: [],
};
