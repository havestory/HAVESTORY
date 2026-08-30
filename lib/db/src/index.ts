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
  ssl: needsSsl ? true : undefined,
  // Keep each serverless instance small so a traffic burst cannot multiply
  // into hundreds of idle database connections. Neon should use its pooled
  // connection URL in production.
  max: Math.min(10, Math.max(1, Number(process.env.DB_POOL_MAX) || 3)),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,  // fail fast rather than hang indefinitely
  keepAlive: true,
  keepAliveInitialDelayMillis: 0,
});
export const db = drizzle(pool, { schema });

export * from "./schema";
