import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const src = path.resolve(rootDir, "artifacts/samar-agrirescue/dist/public");
const dest = path.resolve(rootDir, "public");

if (fs.existsSync(src)) {
  fs.mkdirSync(dest, { recursive: true });
  fs.cpSync(src, dest, { recursive: true });
  console.log(`[copy-dist] Copied static build from ${src} to ${dest}`);
} else {
  console.warn(`[copy-dist] Warning: source directory not found at ${src}`);
}
