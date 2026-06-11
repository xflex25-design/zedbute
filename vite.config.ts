// vite.config.ts
export default defineConfig(({ mode }) => ({
  server: {
    host: "0.0.0.0",
    port: 8080,
    // Add your specific host here or use the wildcard pattern below
    allowedHosts: [
      "sb-2trqkt1j7egp.vercel.run",
      ".vercel.run" // This wildcard covers future host changes in this environment
    ],
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));