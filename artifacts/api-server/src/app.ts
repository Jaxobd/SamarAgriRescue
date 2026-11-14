import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "node:path";
import fs from "node:fs";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

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
app.use(cors({
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
    /\.loca\.lt$/,
  ],
  credentials: true,
}));
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ limit: "15mb", extended: true }));

app.use("/api", router);

// Serve frontend static client assets when built (SPA fallback for Express 5)
const candidatePaths = [
  path.resolve(__dirname, "../../samar-agrirescue/dist/public"),
  path.resolve(process.cwd(), "artifacts/samar-agrirescue/dist/public"),
  path.resolve(__dirname, "../samar-agrirescue/dist/public"),
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
