const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

async function main() {
  const databaseUrl = process.env.DATABASE_URL || process.argv[2];

  if (!databaseUrl) {
    console.error("❌ Error: DATABASE_URL is not set.");
    console.error("Usage: DATABASE_URL=postgres://user:pass@host:5432/dbname node database/publish.js");
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

    const sqlPath = path.resolve(__dirname, "./agrirescue_publish_dump.sql");
    console.log(`📄 Reading SQL publishing file from: ${sqlPath}`);
    const sql = fs.readFileSync(sqlPath, "utf-8");

    console.log("⚡ Executing database schema and seed script...");
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
    console.log(`  - Activities: ${activityCount.rows[0].count}`);
    console.log("\n🚀 Your database is live and ready for publishing!\n");
  } catch (err) {
    console.error("❌ Database publishing failed:", err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
