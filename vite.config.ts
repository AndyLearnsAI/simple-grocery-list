import { defineConfig, loadEnv, type PluginOption } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { Buffer } from "node:buffer";
import { componentTagger } from "lovable-tagger";

function voiceIntentDevMiddleware(): PluginOption {
  return {
    name: "voice-intent-dev-middleware",
    apply: "serve",
    async configureServer(server) {
      const { buffer } = await import("node:stream/consumers");
      const { default: handler } = await import("./api/voice-intent");

      if (typeof handler !== "function") {
        console.warn("[voice-intent] Unable to load API handler for dev middleware");
        return;
      }

      server.middlewares.use("/api/voice-intent", async (req, res) => {
        try {
          const originalUrl = (req as any).originalUrl ?? req.url ?? "";
          const url = new URL(originalUrl, "http://localhost");
          const method = (req.method ?? "GET").toUpperCase();

          const headers = new Headers();
          for (const [key, value] of Object.entries(req.headers)) {
            if (Array.isArray(value)) {
              value.filter(Boolean).forEach((v) => headers.append(key, v));
            } else if (typeof value === "string") {
              headers.append(key, value);
            }
          }

          const init: RequestInit = { method, headers };

          if (!["GET", "HEAD"].includes(method)) {
            const rawBody = await buffer(req);
            if (rawBody?.length) {
              init.body = rawBody;
            }
          }

          const request = new Request(url.toString(), init);
          const response = await handler(request);

          res.statusCode = response.status;
          response.headers.forEach((value, key) => {
            res.setHeader(key, value);
          });

          const responseBody = await response.arrayBuffer();
          res.end(Buffer.from(responseBody));
        } catch (error) {
          console.error("[voice-intent] dev handler failed", error);
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Voice assistant dev handler failed" }));
        }
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  for (const [key, value] of Object.entries(env)) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }

  return {
    base: "/",
    plugins: [
      react(),
      mode === "development" && componentTagger(),
      voiceIntentDevMiddleware(),
    ].filter(Boolean) as PluginOption[],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
