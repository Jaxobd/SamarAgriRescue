import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

const DEFAULT_DATABASE_URL =
  "postgresql://neondb_owner:npg_B01aCmyzQUVq@ep-red-darkness-zag421fk-pooler.c-2.eu-west-2.aws.neon.tech/neondb?sslmode=require";

export const databaseUrl = process.env.DATABASE_URL || DEFAULT_DATABASE_URL;

export const pool = new Pool({ connectionString: databaseUrl });
export const db = drizzle(pool, { schema });

export * from "./schema";
