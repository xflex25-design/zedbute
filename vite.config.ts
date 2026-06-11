// vite.config.ts
// vite.config.ts
export default defineConfig(({ mode }) => ({
  server: {
    host: "0.0.0.0",
    port: 8080,
    // ADD THIS BLOCK BELOW:
    allowedHosts: [
      "sb-2trqkt1j7egp.vercel.run",
      ".vercel.run"
    ],
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  // ... rest of your code