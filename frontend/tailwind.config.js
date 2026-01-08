// tailwind.config.js

module.exports = {
  darkMode: 'class', // This line enables class-based dark mode
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Windows 11 Fluent Design Dark Theme Colors
        win: {
          // Background layers (dark mode)
          'bg-solid': '#202020',        // Solid background base
          'bg-mica': '#1f1f1f',          // Mica effect background
          'bg-acrylic': '#2c2c2c',       // Acrylic background
          'bg-layer': '#2d2d2d',         // Card/layer background
          'bg-layer-alt': '#292929',     // Alternate layer
          'bg-subtle': '#323232',        // Subtle background
          'bg-hover': '#3d3d3d',         // Hover state
          'bg-pressed': '#454545',       // Pressed state
          // Text colors
          'text-primary': '#ffffff',
          'text-secondary': '#d6d6d6',
          'text-tertiary': '#9d9d9d',
          'text-disabled': '#6d6d6d',
          // Accent colors (Windows blue)
          'accent': '#60cdff',           // Light accent
          'accent-secondary': '#0078d4', // Primary blue
          'accent-tertiary': '#003d6d',  // Dark accent
          // Border colors
          'border-default': '#3d3d3d',
          'border-subtle': '#2d2d2d',
          // Light mode
          'light-bg': '#f3f3f3',
          'light-bg-layer': '#ffffff',
          'light-bg-hover': '#e9e9e9',
          'light-text': '#1a1a1a',
          'light-text-secondary': '#5d5d5d',
        }
      },
      fontFamily: {
        'segoe': ['"Segoe UI Variable"', '"Segoe UI"', 'system-ui', '-apple-system', 'sans-serif'],
      },
      borderRadius: {
        'win': '8px',    // Windows 11 corner radius
        'win-lg': '12px', // Larger rounded corners
      },
      boxShadow: {
        'win-card': '0 2px 4px rgba(0, 0, 0, 0.14), 0 0 2px rgba(0, 0, 0, 0.12)',
        'win-elevated': '0 8px 16px rgba(0, 0, 0, 0.14), 0 0 2px rgba(0, 0, 0, 0.12)',
        'win-flyout': '0 16px 32px rgba(0, 0, 0, 0.24), 0 0 2px rgba(0, 0, 0, 0.12)',
      },
      backdropBlur: {
        'win': '30px',
      },
    },
  },
  plugins: [],
};
