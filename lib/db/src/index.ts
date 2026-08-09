import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

const dbUrl = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;

if (!dbUrl) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Enable SSL for Neon (detected by hostname) or in any production environment
const needsSsl = dbUrl.includes("neon.tech") || process.env.NODE_ENV === "production";

export const pool = new Pool({
  connectionString: dbUrl,
  ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
  /* Neon-friendly pool settings: keep connections alive to avoid cold starts */
  max: 5,
  idleTimeoutMillis: 300000,       // keep idle connections open for 5 min
  connectionTimeoutMillis: 10000,  // fail fast rather than hang indefinitely
  keepAlive: true,
  keepAliveInitialDelayMillis: 0,
});
export const db = drizzle(pool, { schema });

export * from "./schema";
