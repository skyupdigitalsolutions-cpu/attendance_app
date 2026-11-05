import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // New versions install and take over by themselves; open apps reload once.
      registerType: "autoUpdate",
      includeAssets: ["icon-192.png", "badge-96.png"],
      manifest: {
        id: "./",
        name: "Attendance Admin",
        short_name: "Att. Admin",
        description: "Admin console for attendance, leave and company policy.",
        start_url: "./",
        scope: "./",
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#ffffff",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
        shortcuts: [
          { name: "Today", url: "./#today" },
          { name: "Leave", url: "./#leave" },
          { name: "IDs", url: "./#ids" },
        ],
      },
      workbox: {
        // Only the app's own files are cached. API calls (attendance data) always go to the server.
        globPatterns: ["**/*.{js,css,html,png,woff2}"],
        navigateFallback: "index.html",
        navigateFallbackDenylist: [/^\/api\//, /^\/iclock\//],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  base: "./",
  // Local development and preview both run on http://localhost:3000
  server: { port: 3000, strictPort: true },
  preview: { port: 3000, strictPort: true },
});