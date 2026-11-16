import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import router from "./routes";
import { logger } from "./lib/logger";
import { uploadsDir } from "./routes/upload";

const app: Express = express();

// Behind Cloudflare/other proxies the public scheme is HTTPS; trust the forwarded headers
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(
  cors({
    origin: [
      "https://SamarAgriRescue.com",
      "https://www.SamarAgriRescue.com",
      "https://samaragrirescue.com",
      "https://www.samaragrirescue.com",
      "http://SamarAgriRescue.com",
      "http://www.SamarAgriRescue.com",
      "http://samaragrirescue.com",
      "http://www.samaragrirescue.com",
      /^http:\/\/localhost(:\d+)?$/,
      /^http:\/\/127\.0\.0\.1(:\d+)?$/,
      /^http:\/\/192\.168\.\d+\.\d+(:\d+)?$/,
      /\.loca\.lt$/,
      /\.trycloudflare\.com$/,
      /\.vercel\.app$/,
    ],
    credentials: true,
  }),
);

app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ limit: "15mb", extended: true }));

// Serve uploaded product images securely
app.use(
  "/api/uploads",
  express.static(uploadsDir, {
    maxAge: "7d",
    setHeaders: (res) => {
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Access-Control-Allow-Origin", "*");
    },
  }),
);

// Mount API routes under /api (client always calls /api/*; root mount would shadow SPA routes)
app.use("/api", router);

// Serve frontend static client assets when built (SPA fallback for Express 5).
// Resolve relative to this bundle first: hosts such as Render run the start
// script with cwd = artifacts/api-server, so cwd-based paths miss the build.
const here = path.dirname(fileURLToPath(import.meta.url));
const candidatePaths = [
  process.env.FRONTEND_DIST,
  path.resolve(here, "../../../artifacts/samar-agrirescue/dist/public"),
  path.resolve(here, "../../../public"),
  path.resolve(process.cwd(), "artifacts/samar-agrirescue/dist/public"),
  path.resolve(process.cwd(), "public"),
].filter((p): p is string => Boolean(p));
const frontendDist = candidatePaths.find((p) => fs.existsSync(path.join(p, "index.html")));

if (frontendDist) {
  logger.info({ frontendDist }, "Serving frontend build");
  app.use(express.static(frontendDist));
  app.use((req, res, next) => {
    if (req.method === "GET" && !req.path.startsWith("/api")) {
      return res.sendFile("index.html", { root: frontendDist });
    }
    next();
  });
} else {
  logger.warn({ candidatePaths }, "No frontend build found; serving API only");
}

export default app;
