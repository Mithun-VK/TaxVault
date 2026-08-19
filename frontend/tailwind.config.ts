import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: '1.5rem',
      screens: { '2xl': '1400px' },
    },
    extend: {
      screens: {
        // Ultra-wide / iMac 5K tier - lets dense grids reclaim space that
        // otherwise strands as dead margin beyond the laptop breakpoints.
        '3xl': '1920px',
      },
      fontSize: {
        // Bumped up ~1px for readability across the dense UI.
        '2xs': ['12px', { lineHeight: '16px', letterSpacing: '0.03em' }],
        xs: ['0.8125rem', { lineHeight: '1.15rem' }], // 13px (was 12px)
        sm: ['0.9375rem', { lineHeight: '1.4rem' }], // 15px (was 14px)
        base: ['1.0625rem', { lineHeight: '1.65rem' }], // 17px (was 16px)
      },
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        'brand-navy': '#1A3C6E',
        'brand-navy-dark': '#153264',
        'brand-navy-muted': '#EBF4FF',
        'brand-teal': '#0F6E56',
        'brand-teal-dark': '#0C5C48',
        'brand-teal-muted': '#E1F5EE',
        'brand-warning': '#92400E',
        'brand-danger': '#991B1B',
        'brand-success': '#14532D',
        'surface-page': '#F8F9FB',
        'surface-card': '#FFFFFF',
        'surface-border': '#E2E6ED',
        'text-primary': '#0F172A',
        'text-secondary': '#334155',
        'text-muted': '#64748B',
        'text-disabled': '#94A3B8',
        status: {
          pending: '#1D4ED8',
          'pending-bg': '#EFF6FF',
          'pending-border': '#BFDBFE',
          overdue: '#991B1B',
          'overdue-bg': '#FEF2F2',
          'overdue-border': '#FECACA',
          paid: '#14532D',
          'paid-bg': '#F0FDF4',
          'paid-border': '#BBF7D0',
          warning: '#92400E',
          'warning-bg': '#FFFBEB',
          'warning-border': '#FDE68A',
        },
      },
      borderRadius: {
        xl: 'calc(var(--radius) + 4px)',
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      letterSpacing: {
        tight: '-0.02em',
      },
      lineHeight: {
        relaxed: '1.6',
      },
      boxShadow: {
        sm: '0 1px 2px 0 rgb(16 24 40 / 0.04), 0 1px 3px 0 rgb(16 24 40 / 0.06)',
        card: '0 1px 3px 0 rgb(16 24 40 / 0.06), 0 1px 2px -1px rgb(16 24 40 / 0.06)',
        'card-hover': '0 4px 12px rgb(16 24 40 / 0.08), 0 2px 4px rgb(16 24 40 / 0.06)',
        drawer: '-8px 0 24px -8px rgb(16 24 40 / 0.12)',
        navy: '0 4px 14px rgb(26 60 110 / 0.25)',
      },
      transitionDuration: {
        fast: '150ms',
        normal: '200ms',
        slow: '300ms',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-right': {
          from: { transform: 'translateX(100%)' },
          to: { transform: 'translateX(0)' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-dot': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.4' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'fade-in': 'fade-in 0.2s ease-out',
        'slide-in-right': 'slide-in-right 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-up': 'slide-up 0.2s cubic-bezier(0.4, 0, 0.2, 1) both',
        'pulse-dot': 'pulse-dot 1.5s ease-in-out infinite',
        shimmer: 'shimmer 1.5s infinite',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
