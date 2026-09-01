import type { NextFunction, Request, Response } from "express";
import { pool } from "@workspace/db";

let ready: Promise<void> | null = null;

function ensureNoticesTable() {
  if (!ready) {
    ready = pool.query(`
      CREATE TABLE IF NOT EXISTS notices (
        id SERIAL PRIMARY KEY,
        message TEXT NOT NULL DEFAULT '',
        style TEXT NOT NULL DEFAULT 'info',
        placement TEXT NOT NULL DEFAULT 'banner',
        enabled INTEGER NOT NULL DEFAULT 1,
        sort_order INTEGER NOT NULL DEFAULT 0,
        topic TEXT,
        image_url TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_notices_sort_order ON notices(sort_order, created_at);
    `).then(() => undefined).catch((error) => {
      ready = null;
      throw error;
    });
  }
  return ready;
}

export async function requireNoticesSchema(_req: Request, res: Response, next: NextFunction) {
  try {
    await ensureNoticesTable();
    next();
  } catch (error) {
    console.error("Unable to prepare notices table", error);
    res.status(500).json({ error: "Site notices are temporarily unavailable" });
  }
}
