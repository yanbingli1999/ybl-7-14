/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
    },
    extend: {
      colors: {
        'monte-bg': '#0B1120',
        'monte-card': '#111827',
        'monte-border': '#1F2937',
        'monte-muted': '#94A3B8',
        'monte-accent': '#6366F1',
        'monte-accent2': '#8B5CF6',
        'monte-safe': '#10B981',
        'monte-warn': '#F59E0B',
        'monte-danger': '#EF4444',
      },
      fontFamily: {
        'mono': ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
        'sans': ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'glow': '0 0 40px -10px rgba(99, 102, 241, 0.4)',
        'glow-green': '0 0 30px -10px rgba(16, 185, 129, 0.4)',
        'glow-red': '0 0 30px -10px rgba(239, 68, 68, 0.5)',
      },
      backgroundImage: {
        'grid-pattern': 'linear-gradient(rgba(99,102,241,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.05) 1px, transparent 1px)',
      },
    },
  },
  plugins: [],
};
