import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const { Client } = pg;

async function main() {
  const DEFAULT_DATABASE_URL = "";
  const databaseUrl = process.env.DATABASE_URL || process.argv[2] || DEFAULT_DATABASE_URL;

  if (!databaseUrl) {
    console.error("❌ Error: DATABASE_URL is not set.");
    console.error("Usage: DATABASE_URL=postgres://user:pass@host:5432/dbname node scripts/publish-db.js");
    process.exit(1);
  }

  console.log("🌱 Connecting to database for publishing...");
  const client = new Client({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes("localhost") || databaseUrl.includes("127.0.0.1") ? false : { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log("✅ Successfully connected to database.");

    const sqlPath = path.resolve(__dirname, "../database/agrirescue_publish_dump.sql");
    console.log(`📄 Reading SQL publishing file from: ${sqlPath}`);
    const sql = fs.readFileSync(sqlPath, "utf-8");

    console.log("⚡ Executing database migration and seed script...");
    await client.query(sql);

    console.log("✨ Samar AgriRescue Database successfully published!");

    const userCount = await client.query("SELECT count(*) FROM agri_users");
    const productCount = await client.query("SELECT count(*) FROM agri_products");
    const reservationCount = await client.query("SELECT count(*) FROM agri_reservations");
    const messageCount = await client.query("SELECT count(*) FROM agri_messages");
    const activityCount = await client.query("SELECT count(*) FROM agri_activities");

    console.log("\n📊 Publication Summary:");
    console.log(`  - Users: ${userCount.rows[0].count}`);
    console.log(`  - Products Listed: ${productCount.rows[0].count}`);
    console.log(`  - Reservations: ${reservationCount.rows[0].count}`);
    console.log(`  - Messages: ${messageCount.rows[0].count}`);
    console.log(`  - Activities Logged: ${activityCount.rows[0].count}`);
    console.log("\n🚀 Your Samar AgriRescue database is ready for live traffic!\n");
  } catch (err) {
    console.error("❌ Database publishing failed:", err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
