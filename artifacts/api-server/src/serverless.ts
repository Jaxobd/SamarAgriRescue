import app from "./app";
import { seedDemoData } from "./lib/agrirescue";

let seeded = false;

export default async function handler(req: any, res: any) {
  if (!seeded) {
    try {
      await seedDemoData();
    } catch (e) {
      console.warn("[serverless] Seed check skipped:", e);
    }
    seeded = true;
  }
  return app(req, res);
}
