import fs from "node:fs";
import path from "node:path";

// Automatically load .env file if available before importing app and database modules
for (const envFile of [
  path.resolve(process.cwd(), ".env"),
  path.resolve(process.cwd(), "artifacts/api-server/.env"),
]) {
  if (fs.existsSync(envFile) && typeof process.loadEnvFile === "function") {
    try {
      process.loadEnvFile(envFile);
      break;
    } catch {}
  }
}

const { default: app } = await import("./app");
const { logger } = await import("./lib/logger");
const { seedDemoData } = await import("./lib/agrirescue");

const rawPort = process.env["PORT"] || "5000";
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

await seedDemoData();

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
