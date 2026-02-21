/** @type {import('tailwindcss').Config} */
export default {
    content: [
      "./index.html",
      "./src/**/*.{js,jsx,ts,tsx}"
    ],
    theme: {
      extend: {
        colors: {
          // Токендер
          bg: "#F8FAFC",         // фон
          panel: "#FFFFFF",      // панельдер
          brand: {               // бренд түс (сілтеме/кнопка)
            600: "#646cff"
          },
          ink: {                 // мәтін түстері
            900: "#0f172a",
            600: "#475569",
            400: "#94a3b8"
          }
        },
        boxShadow: {
          soft: "0 1px 3px 0 rgb(0 0 0 / 0.08), 0 1px 2px -1px rgb(0 0 0 / 0.08)"
        }
      }
    },
    plugins: []
  };
  