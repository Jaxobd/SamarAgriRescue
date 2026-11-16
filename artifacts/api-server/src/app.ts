import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "node:path";
import fs from "node:fs";
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

// Serve frontend static client assets when built (SPA fallback for Express 5)
const candidatePaths = [
  path.resolve(process.cwd(), "artifacts/samar-agrirescue/dist/public"),
  path.resolve(process.cwd(), "public"),
];
const frontendDist = candidatePaths.find((p) => fs.existsSync(p));

if (frontendDist) {
  app.use(express.static(frontendDist));
  app.use((req, res, next) => {
    if (req.method === "GET" && !req.path.startsWith("/api")) {
      return res.sendFile("index.html", { root: frontendDist });
    }
    next();
  });
}

export default app;
