import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { pool } from "@workspace/db";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

router.get("/healthz/db", async (_req, res) => {
  let client;
  try {
    client = await pool.connect();
    await client.query("SELECT 1");
    res.setHeader("Cache-Control", "no-store");
    res.json({ db: "ok" });
  } catch {
    // Never expose connection strings, driver codes, environment names or raw
    // database errors from a public health endpoint.
    res.setHeader("Cache-Control", "no-store");
    res.status(503).json({ db: "unavailable" });
  } finally {
    client?.release();
  }
});

export default router;
