import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { onceRouter } from "./server/once/routes";
import { onceWebhookHandler } from "./server/once/webhook";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const isProduction = process.env.NODE_ENV === "production";
  const port = Number(process.env.PORT) || 3000;

  app.set("trust proxy", 1);

  // Capture raw body buffer on incoming requests for webhook HMAC signature verification
  app.use(
    express.json({
      verify: (req: express.Request & { rawBody?: Buffer }, _res, buf) => {
        req.rawBody = buf;
      },
      limit: "50mb",
    })
  );
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));

  // Public HTTPS ONCE Release Status Webhook Endpoint
  app.post("/api/webhooks/once", onceWebhookHandler);

  // Mount ONCE Distribution Engine API endpoints
  app.use("/api/once", onceRouter);

  // Return clean JSON errors for malformed request bodies on API endpoints
  app.use("/api", (err: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err && typeof err === "object" && "type" in err && (err as { type?: string }).type === "entity.parse.failed") {
      return res.status(400).json({ error: "Invalid JSON payload" });
    }
    return next(err);
  });

  // Health check endpoint
  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      service: "Zedbute Music Distribution Engine",
      time: new Date().toISOString(),
    });
  });

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true, host: "0.0.0.0", port },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.resolve(distPath, "index.html"));
    });
  }

  app.listen(port, "0.0.0.0", () => {
    console.log(`[Zedbute Engine] Server running at http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error("[Zedbute Engine] Failed to start server:", err);
  process.exit(1);
});
