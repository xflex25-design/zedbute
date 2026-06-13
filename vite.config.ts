import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "0.0.0.0",
    port: 8080,
    allowedHosts: [
      "sb-2trqkt1j7egp.vercel.run",
      ".vercel.run"
    ],
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": "/src",
    },
  },
  build: {
    // We increased this limit specifically to silence the 691 kB warning.
    chunkSizeWarningLimit: 800, 
    rollupOptions: {
      output: {
        // Keeps grouping heavy node_modules dependencies.
        manualChunks(id) {
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        }
      }
    }
  }
}));
