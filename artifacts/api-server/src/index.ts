import app from "./app";
import { logger } from "./lib/logger";
import { pool } from "@workspace/db";
import { runStartupMigrations } from "./lib/startup-migrations";
import { startFinanceReportScheduler } from "./lib/finance-report-scheduler";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  /* Warm up the Neon database connection immediately so the first user
     request doesn't hit a cold start. Also keep the connection alive
     with a periodic ping every 4 minutes (Neon idles after 5 min). */
  const warmup = async () => {
    try {
      const client = await pool.connect();
      await client.query("SELECT 1");
      client.release();
      logger.info("Database connection warmed up");
    } catch (e) {
      logger.warn({ err: e }, "DB warmup failed — will retry on first request");
    }
  };

  warmup();
  setInterval(warmup, 4 * 60 * 1000); // ping every 4 minutes

  /* Ensure all columns exist — idempotent, safe to run on every start */
  runStartupMigrations(msg => logger.info(msg));

  /* Monthly finance report scheduler */
  startFinanceReportScheduler(msg => logger.info(msg));
});
