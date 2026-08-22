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

/* Warm up the Neon database connection immediately so the first user request
   does not hit a cold start. Keep the connection alive with a periodic ping. */
const warmup = async () => {
  try {
    const client = await pool.connect();
    await client.query("SELECT 1");
    client.release();
    logger.info("Database connection warmed up");
  } catch (error) {
    logger.warn({ err: error }, "DB warmup failed — will retry on the next interval");
  }
};

async function startServer() {
  try {
    // Complete compatibility DDL before the server accepts traffic. This
    // prevents the first catalog request from racing product migrations.
    await runStartupMigrations(msg => logger.info(msg));
    await warmup();

    const server = app.listen(port, () => {
      logger.info({ port }, "Server listening");
      setInterval(warmup, 4 * 60 * 1000); // Neon idles after 5 minutes.
      startFinanceReportScheduler(msg => logger.info(msg));
    });

    server.on("error", (error) => {
      logger.error({ err: error }, "Error listening on port");
      process.exit(1);
    });
  } catch (error) {
    logger.error({ err: error }, "Startup database preparation failed");
    process.exit(1);
  }
}

void startServer();
