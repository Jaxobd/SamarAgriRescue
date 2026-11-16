import { drizzle as drizzlePg, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import path from "node:path";
import fs from "node:fs";
import * as schema from "./schema";

const { Pool } = pg;

export type AppDatabase = NodePgDatabase<typeof schema> | any;

const DDL = `
CREATE TABLE IF NOT EXISTS agri_users (
  id serial PRIMARY KEY,
  full_name varchar(160) NOT NULL,
  username varchar(80) NOT NULL UNIQUE,
  email varchar(255) NOT NULL UNIQUE,
  password_hash text NOT NULL,
  phone varchar(40),
  location varchar(160),
  user_type varchar(30) NOT NULL,
  profile_image text,
  bio text,
  google_id varchar(128),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agri_products (
  id serial PRIMARY KEY,
  producer_id integer NOT NULL REFERENCES agri_users(id),
  name varchar(160) NOT NULL,
  category varchar(80) NOT NULL,
  description text,
  price numeric(12, 2) NOT NULL,
  quantity numeric(12, 2) NOT NULL,
  unit varchar(40) NOT NULL,
  location varchar(160) NOT NULL,
  image text,
  images jsonb NOT NULL DEFAULT '[]'::jsonb,
  availability_date date,
  status varchar(30) NOT NULL DEFAULT 'Available',
  is_rescue boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agri_reservations (
  id serial PRIMARY KEY,
  product_id integer NOT NULL REFERENCES agri_products(id),
  buyer_id integer NOT NULL REFERENCES agri_users(id),
  quantity numeric(12, 2) NOT NULL,
  status varchar(30) NOT NULL DEFAULT 'Pending',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agri_messages (
  id serial PRIMARY KEY,
  sender_id integer NOT NULL REFERENCES agri_users(id),
  receiver_id integer NOT NULL REFERENCES agri_users(id),
  product_id integer REFERENCES agri_products(id),
  message text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agri_reports (
  id serial PRIMARY KEY,
  reporter_id integer NOT NULL REFERENCES agri_users(id),
  product_id integer NOT NULL REFERENCES agri_products(id),
  reason varchar(160) NOT NULL,
  description text,
  status varchar(30) NOT NULL DEFAULT 'Open',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agri_activities (
  id serial PRIMARY KEY,
  user_id integer REFERENCES agri_users(id),
  type varchar(50) NOT NULL,
  action varchar(255) NOT NULL,
  details text,
  entity_id integer,
  entity_type varchar(50),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agri_notifications (
  id serial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES agri_users(id),
  actor_id integer REFERENCES agri_users(id),
  type varchar(50) NOT NULL,
  title varchar(255) NOT NULL,
  body text,
  link text,
  product_id integer REFERENCES agri_products(id),
  entity_id integer,
  entity_type varchar(50),
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE agri_products ADD COLUMN IF NOT EXISTS images jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE agri_users ADD COLUMN IF NOT EXISTS profile_image text;
ALTER TABLE agri_users ADD COLUMN IF NOT EXISTS bio text;
ALTER TABLE agri_users ADD COLUMN IF NOT EXISTS google_id varchar(128);
`;

const DATABASE_URL = (process.env.DATABASE_URL ?? "").trim();

let pool: pg.Pool | null = null;
let db: any;
let schemaBootstrap: Promise<unknown> | null = null;

export async function ensureSchema() {
  if (!schemaBootstrap) return;
  try {
    await schemaBootstrap;
  } catch (err) {
    console.error("Schema bootstrap failed:", err);
  }
}

if (DATABASE_URL) {
  pool = new Pool({ connectionString: DATABASE_URL });
  db = drizzlePg(pool, { schema });
} else if (process.env.VERCEL || process.env.NODE_ENV === "production") {
  throw new Error(
    "DATABASE_URL is not set. Add it to .env locally, or to your hosting provider's environment variables in production.",
  );
} else {
  // Local development without DATABASE_URL: use embedded PGlite.
  try {
    const pglitePkgName = "@electric-sql/pglite";
    const drizzlePglitePkgName = "drizzle-orm/pglite";
    const { PGlite } = await import(pglitePkgName);
    const { drizzle: drizzlePglite } = await import(drizzlePglitePkgName);
    const dbDir = path.resolve(process.cwd(), ".data/pgdata");
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    const client = new PGlite(dbDir);
    schemaBootstrap = client.exec(DDL);
    db = drizzlePglite(client, { schema });
  } catch (err) {
    console.error("Local PGlite database failed to start:", err);
    throw new Error("No database available. Fix the local PGlite error above, or set DATABASE_URL in .env.");
  }
}

if (pool) {
  schemaBootstrap = pool.query(DDL);
}

export { pool, db };
export * from "./schema";
