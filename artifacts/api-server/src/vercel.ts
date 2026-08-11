import app from "./app";
import { runStartupMigrations } from "./lib/startup-migrations";

// Run schema migrations on every cold start so production columns stay in sync.
// ALTER TABLE … IF NOT EXISTS is idempotent — safe to run on every cold start.
runStartupMigrations();

export default app;
