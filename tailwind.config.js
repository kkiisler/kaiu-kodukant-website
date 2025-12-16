/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.html',
    './components/**/*.html',
    './js/**/*.js'
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      colors: {
        // New vibrant color palette
        'silk': '#F3F0EA',           // Silk Pillow - light cream background
        'apricot': '#E8A760',         // Apricot Sorbet - warm orange accent
        'cinnamon': '#D26911',        // Cinnamon - vibrant orange primary
        'kofta': '#883322',           // Kofta Brown - deep brown for text/contrast
        'sirocco': '#68766E',         // Sirocco - muted green-gray
        'cascades': '#273E3E',        // Sunken Cascades - dark teal

        // Mapped to semantic names for easier use
        background: {
          primary: '#F3F0EA',       // Silk Pillow
          secondary: '#FEFDFB',     // Even lighter silk
          tertiary: '#E8D5C4',      // Slightly darker silk
          dark: '#273E3E',          // Sunken Cascades for dark sections
        },
        text: {
          primary: '#273E3E',       // Sunken Cascades
          secondary: '#68766E',     // Sirocco
          tertiary: '#883322',      // Kofta Brown
          subtle: '#A08976',        // Muted brown
          light: '#F3F0EA',         // Silk for light text on dark bg
        },
        brand: {
          primary: '#D26911',       // Cinnamon
          primary_hover: '#B85A0E', // Darker cinnamon
          secondary: '#E8A760',     // Apricot Sorbet
          light: '#FAE6D0',         // Light apricot
          border: '#E8D5C4',        // Warm border
        },
        accent: {
          primary: '#E8A760',       // Apricot Sorbet
          secondary: '#D26911',     // Cinnamon
          tertiary: '#883322',      // Kofta Brown
          quaternary: '#68766E',    // Sirocco
          quinary: '#273E3E',       // Sunken Cascades
        }
      },
      spacing: {
        'block': '1.2rem',
      },
      maxWidth: {
        'content': '620px',
        'wide': '1280px',
      },
      backgroundImage: {
        'gradient-warm': 'linear-gradient(135deg, #F3F0EA 0%, #E8A760 50%, #D26911 100%)',
        'gradient-subtle': 'linear-gradient(180deg, #F3F0EA 0%, #FAE6D0 100%)',
      }
    }
  },
  plugins: [],
}
