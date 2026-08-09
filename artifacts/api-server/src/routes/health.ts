import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { pool } from "@workspace/db";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

router.get("/healthz/db", async (_req, res) => {
  const dbUrl = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL || "";
  const maskedUrl = dbUrl
    ? dbUrl.replace(/:([^:@]+)@/, ":***@").slice(0, 80) + "..."
    : "(not set)";
  try {
    const client = await pool.connect();
    const result = await client.query("SELECT NOW() as now");
    client.release();
    res.json({
      db: "ok",
      time: result.rows[0].now,
      url_hint: maskedUrl,
      node_env: process.env.NODE_ENV || "(not set)",
    });
  } catch (err: any) {
    res.status(500).json({
      db: "error",
      message: err?.message,
      code: err?.code,
      url_hint: maskedUrl,
      node_env: process.env.NODE_ENV || "(not set)",
    });
  }
});

export default router;
