import type { Request, Response } from "express";

/**
 * Parse a numeric route parameter and return it as an integer.
 *
 * If the parameter is missing, non-numeric, negative, or otherwise not a
 * positive 32-bit integer, this writes a 400 response on `res` and
 * returns `null` so the caller can short-circuit:
 *
 *     const id = parseIdParam(req, res);
 *     if (id === null) return;
 *
 * Without this guard `parseInt(req.params.id)` returns `NaN`, which then
 * flows into a Drizzle WHERE clause and causes a generic 500. This helper
 * gives the client an immediate, well-typed error instead.
 */
export function parseIdParam(req: Request, res: Response, paramName = "id"): number | null {
  const raw = req.params[paramName];
  if (typeof raw !== "string" || raw.length === 0) {
    res.status(400).json({ error: `Missing ${paramName} parameter` });
    return null;
  }
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0 || String(n) !== raw) {
    res.status(400).json({ error: `Invalid ${paramName}: ${raw}` });
    return null;
  }
  return n;
}
