import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { componentTagger } from "lovable-tagger";
import { readFileSync } from "node:fs";

// The Supabase integration exposes NEXT_PUBLIC_SUPABASE_* / SUPABASE_* env vars,
// but the generated client reads import.meta.env.VITE_SUPABASE_*. Vite only exposes
// VITE_-prefixed vars to client code, so we map the available values into the
// VITE_ names here. Without this, the Supabase client is created with undefined
// credentials and every upload/insert hangs.
//
// Values resolve from process.env first (Vercel deployments / CI), then fall back
// to local env files used during development.
function loadEnvFromFiles(): Record<string, string> {
  const files = [
    "/vercel/share/.env.project",
    new URL(".env.development.local", import.meta.url).pathname,
    new URL(".env.local", import.meta.url).pathname,
  ];
  const env: Record<string, string> = {};
  for (const file of files) {
    try {
      const content = readFileSync(file, "utf8");
      for (const line of content.split("\n")) {
        const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
        if (!match) continue;
        let value = match[2].trim();
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        if (env[match[1]] === undefined) env[match[1]] = value;
      }
    } catch {
      // file not present in this environment; ignore
    }
  }
  return env;
}

const fileEnv = loadEnvFromFiles();
const resolveEnv = (...keys: string[]) => {
  for (const key of keys) {
    if (process.env[key]) return process.env[key] as string;
    if (fileEnv[key]) return fileEnv[key];
  }
  return "";
};

const SUPABASE_URL = resolveEnv(
  "VITE_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_URL"
);
const SUPABASE_PUBLISHABLE_KEY = resolveEnv(
  "VITE_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_ANON_KEY"
);

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  console.warn(
    "[vite.config] Missing Supabase credentials. Supabase requests will fail."
  );
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  define: {
    "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(SUPABASE_URL),
    "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(
      SUPABASE_PUBLISHABLE_KEY
    ),
  },
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

