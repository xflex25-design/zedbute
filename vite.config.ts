import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  // Expose both VITE_ and NEXT_PUBLIC_ prefixed env vars to the client.
  // This project's Supabase/public env vars use the NEXT_PUBLIC_ prefix.
  // NOTE: never add a prefix that would leak server-only secrets (e.g. SUPABASE_SERVICE_ROLE_KEY).
  envPrefix: ["VITE_", "NEXT_PUBLIC_"],
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
}));

