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
`;

const DEFAULT_DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_B01aCmyzQUVq@ep-red-darkness-zag421fk-pooler.c-2.eu-west-2.aws.neon.tech/neondb?sslmode=require";

let pool: pg.Pool | null = null;
let db: any;

if (process.env.DATABASE_URL) {
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  db = drizzlePg(pool, { schema });
} else if (process.env.VERCEL || process.env.NODE_ENV === "production") {
  pool = new Pool({ connectionString: DEFAULT_DATABASE_URL });
  db = drizzlePg(pool, { schema });
} else {
  // Try local embedded PGlite for local development, or fallback to remote Postgres
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
    client.exec(DDL).catch(() => {});
    db = drizzlePglite(client, { schema });
  } catch (err) {
    pool = new Pool({ connectionString: DEFAULT_DATABASE_URL });
    db = drizzlePg(pool, { schema });
  }
}

export { pool, db };
export * from "./schema";
