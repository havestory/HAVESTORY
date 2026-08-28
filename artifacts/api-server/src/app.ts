import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import cookieParser from "cookie-parser";
import router from "./routes";
import { logger } from "./lib/logger";
import { staffActivityLogger, staffPermissionGate } from "./lib/team-access";

const app: Express = express();

// Trust Vercel's reverse proxy so secure cookies work over HTTPS
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
const isProduction = process.env.NODE_ENV === "production";

// Allow the Replit dev host OR a specific FRONTEND_ORIGIN in production.
// The FRONTEND_ORIGIN env var should be the full URL of your Vercel frontend,
// e.g. https://havestory.vercel.app
const allowedOrigins = process.env.FRONTEND_ORIGIN
  ? process.env.FRONTEND_ORIGIN.split(",").map((o) => o.trim())
  : [];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (!isProduction) return callback(null, true);
      if (allowedOrigins.length === 0) {
        // Keep local/development flexibility, but do not silently widen a production deployment.
        if (isProduction) return callback(new Error("FRONTEND_ORIGIN must be configured in production"));
        return callback(null, true);
      }
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
  })
);

// Bound request bodies to protect the API from accidental or abusive memory use.
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(cookieParser());
app.use(staffPermissionGate);
app.use(staffActivityLogger);

app.use("/api", router);

// Keep API failures machine-readable, especially Multer/body-limit errors.
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  if (err?.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ error: "The uploaded file is too large. Please choose a smaller file." });
  }
  if (err?.code === "LIMIT_FILE_COUNT" || err?.code === "LIMIT_PART_COUNT" || err?.code === "LIMIT_FIELD_COUNT") {
    return res.status(413).json({ error: "Too many files or form fields were submitted." });
  }
  if (err?.message?.startsWith("CORS:")) {
    return res.status(403).json({ error: "This website is not allowed to access the API." });
  }
  if (err?.type === "entity.too.large") {
    return res.status(413).json({ error: "The request is too large." });
  }
  console.error("Unhandled API error", err);
  return res.status(500).json({ error: "Something went wrong. Please try again." });
});

export default app;
