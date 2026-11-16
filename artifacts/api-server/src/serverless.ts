import app from "./app";
import { ensureSchema } from "@workspace/db";
import { seedDemoData } from "./lib/agrirescue";

let seeded = false;

// Initialize demo data once on first request in serverless
app.use(async (_req, _res, next) => {
  if (!seeded) {
    try {
      await ensureSchema();
      await seedDemoData();
    } catch (e) {
      console.warn("[serverless] Seed check skipped:", e);
    }
    seeded = true;
  }
  next();
});

export default app;
