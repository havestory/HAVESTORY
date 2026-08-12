import app from "./app";
import { ensureRuntimeSchema } from "./lib/runtime-schema";

// Vercel used to start a large, unawaited migration on every cold start. That
// competed with live requests for the small Neon connection pool and allowed
// handlers to query half-migrated tables. A versioned, locked compatibility
// pass now completes once before the first request reaches Express.
export default async function handler(req: any, res: any) {
  try {
    await ensureRuntimeSchema();
    return app(req, res);
  } catch (error) {
    console.error("[runtime-schema] Database preparation failed", error);
    if (!res.headersSent) return res.status(503).json({ error: "Database is preparing. Please retry shortly." });
  }
}
