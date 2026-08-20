import { Router, type Request, type Response } from "express";
import crypto from "crypto";
import { db, pool } from "@workspace/db";
import {
  ordersTable,
  invoicesTable,
  clientsTable,
  crmProjectsTable,
} from "@workspace/db/schema";
import { eq, lt, isNull, isNotNull, sql, and, type SQL } from "drizzle-orm";
import { runInvoiceClientBackfill } from "@workspace/invoice-client-link";
import { deleteCloudinaryUrls } from "../lib/cloudinary";
import {
  setPendingCookie,
  setAdminCookie,
  clearAuthCookies,
  getPendingAuth,
  getAdminAuth,
  requireAdmin,
  requireOwner,
  requirePermission,
} from "../lib/auth-cookie";
import {
  ensureTeamTables,
  hashStaffPassword,
  verifyStaffPassword,
  STAFF_PERMISSIONS,
} from "../lib/team-access";

const router = Router();

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "Admin.HAVESTORY";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
const ADMIN_PIN = process.env.ADMIN_PIN || "";

if (!ADMIN_PASSWORD) {
  console.error(
    "⚠️  SECURITY WARNING: ADMIN_PASSWORD env var is not set — admin login is wide open!",
  );
}
if (!ADMIN_PIN) {
  console.error(
    "⚠️  SECURITY WARNING: ADMIN_PIN env var is not set — PIN step is wide open!",
  );
}

const MAX_PIN_ATTEMPTS = 5;

// ── In-memory IP-based rate limiter for Step 1 (username + password) ─────────
interface RateEntry {
  count: number;
  resetAt: number;
}
const loginRateMap = new Map<string, RateEntry>();
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 10;

// In-memory PIN attempt tracker keyed by pending token signature prefix
// (short-lived, only needed for the 10-minute pending window)
const pinAttemptMap = new Map<string, number>();

function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0].trim();
  return req.socket?.remoteAddress ?? "unknown";
}

function checkLoginRate(ip: string): {
  allowed: boolean;
  retryAfterSec: number;
} {
  const now = Date.now();
  const entry = loginRateMap.get(ip);
  if (!entry || now > entry.resetAt) {
    loginRateMap.set(ip, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    return { allowed: true, retryAfterSec: 0 };
  }
  if (entry.count >= LOGIN_MAX_ATTEMPTS) {
    return {
      allowed: false,
      retryAfterSec: Math.ceil((entry.resetAt - now) / 1000),
    };
  }
  entry.count++;
  return { allowed: true, retryAfterSec: 0 };
}

// ── Timing-safe string comparison ─────────────────────────────────────────────
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    crypto.timingSafeEqual(
      Buffer.alloc(bufA.length),
      Buffer.alloc(bufA.length),
    );
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

/* ── Step 1 — username + password ────────────────────────────────────────── */
router.post("/login", async (req: Request, res: Response) => {
  const ip = getClientIp(req);
  const rate = checkLoginRate(ip);
  if (!rate.allowed) {
    res.setHeader("Retry-After", String(rate.retryAfterSec));
    return res
      .status(429)
      .json({
        error: `Too many login attempts. Try again in ${Math.ceil(rate.retryAfterSec / 60)} minute(s).`,
      });
  }
  const { username, password } = req.body;
  if (
    typeof username !== "string" ||
    typeof password !== "string" ||
    !password
  ) {
    return res.status(401).json({ error: "Invalid username or password" });
  }

  const ownerValid =
    !!ADMIN_PASSWORD &&
    !!ADMIN_PIN &&
    safeEqual(username, ADMIN_USERNAME) &&
    safeEqual(password, ADMIN_PASSWORD);
  if (ownerValid) {
    setPendingCookie(res, username);
    return res.json({ success: true, requiresPin: true, role: "owner" });
  }

  try {
    await ensureTeamTables();
    const { rows } = await pool.query(
      "SELECT id,name,username,password_hash,permissions,active FROM admin_staff WHERE LOWER(username)=LOWER($1) LIMIT 1",
      [username.trim()],
    );
    const staff = rows[0];
    if (staff?.active && verifyStaffPassword(password, staff.password_hash)) {
      const permissions = Array.isArray(staff.permissions)
        ? staff.permissions.map(String)
        : [];
      setAdminCookie(
        res,
        staff.username,
        "staff",
        permissions,
        Number(staff.id),
      );
      await pool.query(
        "UPDATE admin_staff SET last_login_at=NOW() WHERE id=$1",
        [staff.id],
      );
      return res.json({ success: true, requiresPin: false, role: "staff" });
    }
  } catch (error) {
    req.log.error(error, "Staff login failed");
  }
  return res.status(401).json({ error: "Invalid username or password" });
});

/* ── Step 2 — PIN verification ───────────────────────────────────────────── */
router.post("/verify-pin", (req: Request, res: Response) => {
  const pending = getPendingAuth(req);
  if (!pending) {
    return res.status(401).json({ error: "No pending authentication session" });
  }

  // Use username as the key for PIN attempt tracking
  const attemptKey = pending.username;
  const attempts = pinAttemptMap.get(attemptKey) || 0;

  if (attempts >= MAX_PIN_ATTEMPTS) {
    clearAuthCookies(res);
    pinAttemptMap.delete(attemptKey);
    return res
      .status(429)
      .json({ error: "Too many PIN attempts. Please start over." });
  }

  // Reject when the PIN env var is empty so callers cannot satisfy the check
  // by submitting an empty string.
  if (!ADMIN_PIN) {
    req.log.error("PIN verification rejected: ADMIN_PIN env var is not set.");
    clearAuthCookies(res);
    return res.status(503).json({
      error: "Admin login is not configured. Set ADMIN_PIN env var.",
    });
  }

  const { pin } = req.body;
  if (typeof pin === "string" && pin.length > 0 && safeEqual(pin, ADMIN_PIN)) {
    clearAuthCookies(res);
    pinAttemptMap.delete(attemptKey);
    setAdminCookie(res, pending.username);
    return res.json({ success: true, message: "Authenticated successfully" });
  }

  const newAttempts = attempts + 1;
  pinAttemptMap.set(attemptKey, newAttempts);
  const remaining = MAX_PIN_ATTEMPTS - newAttempts;

  if (remaining <= 0) {
    clearAuthCookies(res);
    pinAttemptMap.delete(attemptKey);
    return res
      .status(429)
      .json({ error: "Too many PIN attempts. Please start over." });
  }

  return res.status(401).json({
    error: `Incorrect PIN. ${remaining} attempt${remaining !== 1 ? "s" : ""} remaining.`,
  });
});

/* ── Safe production material usage (no cost/profit exposure) ─────────── */
router.get(
  "/production-usage/materials",
  requirePermission("production"),
  async (_req: Request, res: Response) => {
    await ensureTeamTables();
    const { rows } = await pool.query(
      "SELECT id,name,quantity,unit,low_stock_threshold FROM inventory ORDER BY name",
    );
    res.json(rows);
  },
);

router.get(
  "/production-usage",
  requirePermission("production"),
  async (req: Request, res: Response) => {
    await ensureTeamTables();
    const auth = getAdminAuth(req)!;
    const requestedMonth = String(req.query.month || "");
    const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(requestedMonth)
      ? requestedMonth
      : colomboDate().slice(0, 7);
    const params: any[] = [month];
    let staffFilter = "";
    if (auth.role === "staff") {
      params.push(auth.staffId);
      staffFilter = " AND u.staff_id=$2";
    }
    const { rows } = await pool.query(
      `SELECT u.id,u.staff_id,u.inventory_item_id,u.reference,u.used_quantity,u.waste_quantity,u.note,u.usage_date,u.created_at,
      i.name AS material_name,i.unit,s.name AS staff_name
    FROM staff_production_usage u JOIN inventory i ON i.id=u.inventory_item_id
    LEFT JOIN admin_staff s ON s.id=u.staff_id
    WHERE u.usage_date >= to_date($1 || '-01','YYYY-MM-DD')
      AND u.usage_date < to_date($1 || '-01','YYYY-MM-DD') + INTERVAL '1 month'${staffFilter}
    ORDER BY u.usage_date DESC,u.created_at DESC`,
      params,
    );
    res.json({ month, role: auth.role, records: rows });
  },
);

router.post(
  "/production-usage",
  requirePermission("production"),
  async (req: Request, res: Response) => {
    await ensureTeamTables();
    const auth = getAdminAuth(req)!;
    const inventoryItemId = Number(req.body?.inventoryItemId);
    const used = Math.max(0, Math.floor(Number(req.body?.usedQuantity) || 0));
    const waste = Math.max(0, Math.floor(Number(req.body?.wasteQuantity) || 0));
    const total = used + waste;
    if (
      !Number.isInteger(inventoryItemId) ||
      inventoryItemId <= 0 ||
      total <= 0
    )
      return res
        .status(400)
        .json({ error: "Material and used/waste quantity are required" });
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const stock = await client.query(
        "UPDATE inventory SET quantity=quantity-$1,updated_at=NOW() WHERE id=$2 AND quantity >= $1 RETURNING id,name,quantity,unit",
        [total, inventoryItemId],
      );
      if (!stock.rows[0]) {
        await client.query("ROLLBACK");
        return res.status(409).json({ error: "Not enough material stock" });
      }
      const { rows } = await client.query(
        `INSERT INTO staff_production_usage(staff_id,inventory_item_id,reference,used_quantity,waste_quantity,note,usage_date)
      VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [
          auth.role === "staff" ? auth.staffId : null,
          inventoryItemId,
          String(req.body?.reference || "")
            .trim()
            .slice(0, 120) || null,
          used,
          waste,
          String(req.body?.note || "")
            .trim()
            .slice(0, 300) || null,
          colomboDate(),
        ],
      );
      await client.query("COMMIT");
      res
        .status(201)
        .json({ ...rows[0], remaining_stock: stock.rows[0].quantity });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      req.log.error(error);
      res.status(500).json({ error: "Could not record production usage" });
    } finally {
      client.release();
    }
  },
);

/* ── Staff attendance ────────────────────────────────────────────────── */
const colomboDate = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Colombo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

router.get("/attendance", requireAdmin, async (req: Request, res: Response) => {
  await ensureTeamTables();
  const auth = getAdminAuth(req)!;
  const requestedMonth = String(req.query.month || "");
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(requestedMonth)
    ? requestedMonth
    : colomboDate().slice(0, 7);
  const params: any[] = [month];
  let staffFilter = "";
  if (auth.role === "staff") {
    params.push(auth.staffId);
    staffFilter = " AND a.staff_id=$2";
  }
  const { rows } = await pool.query(
    `SELECT a.*,s.name AS staff_name,s.username,
      CASE WHEN a.check_out_at IS NOT NULL THEN GREATEST(0,FLOOR(EXTRACT(EPOCH FROM (a.check_out_at-a.check_in_at))/60))::int ELSE NULL END AS duration_minutes
    FROM staff_attendance a JOIN admin_staff s ON s.id=a.staff_id
    WHERE a.attendance_date >= to_date($1 || '-01','YYYY-MM-DD')
      AND a.attendance_date < to_date($1 || '-01','YYYY-MM-DD') + INTERVAL '1 month'${staffFilter}
    ORDER BY a.attendance_date DESC,a.check_in_at DESC`,
    params,
  );
  res.json({ month, role: auth.role, today: colomboDate(), records: rows });
});

router.get(
  "/attendance-pending",
  requireOwner,
  async (_req: Request, res: Response) => {
    await ensureTeamTables();
    const { rows } =
      await pool.query(`SELECT a.id,a.attendance_date,a.check_in_at,s.name AS staff_name,s.username
    FROM staff_attendance a JOIN admin_staff s ON s.id=a.staff_id
    WHERE a.status='pending' ORDER BY a.check_in_at DESC LIMIT 50`);
    res.json(rows);
  },
);

router.post(
  "/attendance/check-in",
  requireAdmin,
  async (req: Request, res: Response) => {
    await ensureTeamTables();
    const auth = getAdminAuth(req)!;
    if (auth.role !== "staff" || !auth.staffId)
      return res
        .status(403)
        .json({ error: "Only staff accounts can request attendance" });
    const date = colomboDate();
    const existing = await pool.query(
      "SELECT id,status FROM staff_attendance WHERE staff_id=$1 AND attendance_date=$2",
      [auth.staffId, date],
    );
    if (existing.rows[0] && existing.rows[0].status !== "rejected")
      return res
        .status(409)
        .json({ error: "Today's attendance request already exists" });
    const { rows } = existing.rows[0]
      ? await pool.query(
          `UPDATE staff_attendance SET check_in_at=NOW(),check_out_at=NULL,status='pending',owner_note=NULL,early_checkout=FALSE,checkout_note=NULL,decided_at=NULL,updated_at=NOW()
        WHERE id=$1 RETURNING *`,
          [existing.rows[0].id],
        )
      : await pool.query(
          `INSERT INTO staff_attendance(staff_id,attendance_date) VALUES($1,$2) RETURNING *`,
          [auth.staffId, date],
        );
    res.status(201).json(rows[0]);
  },
);

router.post(
  "/attendance/:id/check-out",
  requireAdmin,
  async (req: Request, res: Response) => {
    await ensureTeamTables();
    const auth = getAdminAuth(req)!;
    if (auth.role !== "staff" || !auth.staffId)
      return res.status(403).json({ error: "Only staff can check out" });
    const id = Number(req.params.id);
    const earlyCheckout = req.body?.earlyCheckout === true;
    const checkoutNote = String(req.body?.note || "")
      .trim()
      .slice(0, 300);
    if (earlyCheckout && !checkoutNote)
      return res
        .status(400)
        .json({ error: "Please add a reason before checking out early" });
    const { rows } = await pool.query(
      `UPDATE staff_attendance
    SET check_out_at=NOW(),early_checkout=$4,checkout_note=$5,updated_at=NOW()
    WHERE id=$1 AND staff_id=$2 AND attendance_date=$3 AND check_out_at IS NULL AND status IN ('pending','approved') RETURNING *`,
      [id, auth.staffId, colomboDate(), earlyCheckout, checkoutNote || null],
    );
    if (!rows[0])
      return res
        .status(404)
        .json({ error: "Active attendance record not found" });
    res.json(rows[0]);
  },
);

router.post(
  "/attendance/:id/decision",
  requireOwner,
  async (req: Request, res: Response) => {
    await ensureTeamTables();
    const id = Number(req.params.id);
    const status =
      req.body?.status === "approved"
        ? "approved"
        : req.body?.status === "rejected"
          ? "rejected"
          : "";
    if (!Number.isInteger(id) || !status)
      return res
        .status(400)
        .json({ error: "Valid attendance decision required" });
    const note =
      String(req.body?.note || "")
        .trim()
        .slice(0, 300) || null;
    const { rows } = await pool.query(
      `UPDATE staff_attendance SET status=$1,owner_note=$2,decided_at=NOW(),updated_at=NOW()
    WHERE id=$3 RETURNING *`,
      [status, note, id],
    );
    if (!rows[0])
      return res.status(404).json({ error: "Attendance request not found" });
    res.json(rows[0]);
  },
);

/* ── Team access management (owner only) ─────────────────────────────── */
router.get("/team", requireOwner, async (_req: Request, res: Response) => {
  await ensureTeamTables();
  const { rows } =
    await pool.query(`SELECT id,name,username,permissions,active,created_at,updated_at,last_login_at
    FROM admin_staff ORDER BY active DESC, name ASC`);
  res.json(rows);
});

router.post("/team", requireOwner, async (req: Request, res: Response) => {
  await ensureTeamTables();
  const name = String(req.body?.name || "").trim();
  const username = String(req.body?.username || "").trim();
  const password = String(req.body?.password || "");
  const permissions = (
    Array.isArray(req.body?.permissions) ? req.body.permissions : []
  )
    .map(String)
    .filter((p: string) =>
      (STAFF_PERMISSIONS as readonly string[]).includes(p),
    );
  if (!name || username.length < 3 || password.length < 10)
    return res
      .status(400)
      .json({
        error:
          "Name, username (3+ characters) and password (10+ characters) are required",
      });
  try {
    const { rows } = await pool.query(
      `INSERT INTO admin_staff(name,username,password_hash,permissions)
      VALUES($1,$2,$3,$4::jsonb) RETURNING id,name,username,permissions,active,created_at,last_login_at`,
      [
        name,
        username,
        hashStaffPassword(password),
        JSON.stringify(permissions),
      ],
    );
    res.status(201).json(rows[0]);
  } catch (error: any) {
    res
      .status(error?.code === "23505" ? 409 : 500)
      .json({
        error:
          error?.code === "23505"
            ? "That username is already used"
            : "Could not create staff account",
      });
  }
});

router.patch("/team/:id", requireOwner, async (req: Request, res: Response) => {
  await ensureTeamTables();
  const id = Number(req.params.id);
  const name = String(req.body?.name || "").trim();
  const username = String(req.body?.username || "").trim();
  const permissions = (
    Array.isArray(req.body?.permissions) ? req.body.permissions : []
  )
    .map(String)
    .filter((p: string) =>
      (STAFF_PERMISSIONS as readonly string[]).includes(p),
    );
  if (!Number.isInteger(id) || !name || username.length < 3)
    return res.status(400).json({ error: "Valid staff details are required" });
  try {
    const { rows } = await pool.query(
      `UPDATE admin_staff SET name=$1,username=$2,permissions=$3::jsonb,active=$4,updated_at=NOW()
      WHERE id=$5 RETURNING id,name,username,permissions,active,created_at,updated_at,last_login_at`,
      [
        name,
        username,
        JSON.stringify(permissions),
        req.body?.active !== false,
        id,
      ],
    );
    if (!rows[0])
      return res.status(404).json({ error: "Staff account not found" });
    res.json(rows[0]);
  } catch (error: any) {
    res
      .status(error?.code === "23505" ? 409 : 500)
      .json({
        error:
          error?.code === "23505"
            ? "That username is already used"
            : "Could not update staff account",
      });
  }
});

router.delete(
  "/team/:id",
  requireOwner,
  async (req: Request, res: Response) => {
    await ensureTeamTables();
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0)
      return res.status(400).json({ error: "Invalid staff ID" });
    const result = await pool.query(
      "DELETE FROM admin_staff WHERE id=$1 RETURNING id",
      [id],
    );
    if (!result.rowCount)
      return res.status(404).json({ error: "Staff account not found" });
    res.json({ success: true });
  },
);

router.post(
  "/team/:id/reset-password",
  requireOwner,
  async (req: Request, res: Response) => {
    await ensureTeamTables();
    const id = Number(req.params.id);
    const password = String(req.body?.password || "");
    if (!Number.isInteger(id) || password.length < 10)
      return res
        .status(400)
        .json({ error: "New password must contain at least 10 characters" });
    const result = await pool.query(
      "UPDATE admin_staff SET password_hash=$1,updated_at=NOW() WHERE id=$2",
      [hashStaffPassword(password), id],
    );
    if (!result.rowCount)
      return res.status(404).json({ error: "Staff account not found" });
    res.json({ success: true });
  },
);

router.get("/activity", requireOwner, async (req: Request, res: Response) => {
  await ensureTeamTables();
  const limit = Math.min(300, Math.max(20, Number(req.query.limit) || 100));
  const { rows } = await pool.query(
    `SELECT id,actor_id,actor_username,action,method,path,status_code,created_at
    FROM admin_activity_log ORDER BY created_at DESC LIMIT $1`,
    [limit],
  );
  res.json(rows);
});

/* ── Storage Cleanup ─────────────────────────────────────────────────────── */
router.post(
  "/cleanup-files",
  requireOwner,
  async (req: Request, res: Response) => {
    if (!getAdminAuth(req)) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    try {
      const cutoff = new Date();
      cutoff.setMonth(cutoff.getMonth() - 3);

      const oldOrders = await db
        .select()
        .from(ordersTable)
        .where(lt(ordersTable.createdAt, cutoff));

      let ordersProcessed = 0;
      let filesDeleted = 0;

      for (const order of oldOrders) {
        const urls: string[] = [];

        if (order.paymentProofUrl) urls.push(order.paymentProofUrl);
        if (order.proofFileUrl) urls.push(order.proofFileUrl);

        try {
          const attachments = JSON.parse(order.attachments || "[]");
          for (const a of attachments) {
            if (typeof a === "string") urls.push(a);
            else if (a?.url) urls.push(a.url);
          }
        } catch {}

        try {
          const onlineFiles = JSON.parse(order.onlineDeliveryFiles || "[]");
          for (const f of onlineFiles) {
            if (typeof f === "string") urls.push(f);
            else if (f?.url) urls.push(f.url);
          }
        } catch {}

        const cloudinaryUrls = urls.filter(
          (u) => u && u.includes("cloudinary.com"),
        );
        if (cloudinaryUrls.length === 0) continue;

        const deleted = await deleteCloudinaryUrls(cloudinaryUrls);
        filesDeleted += deleted;

        // Scope the update to the current order. The previous implementation
        // re-applied this UPDATE to every old order on every loop iteration
        // because it used `lt(createdAt, cutoff)`.
        await db
          .update(ordersTable)
          .set({
            attachments: "[]",
            onlineDeliveryFiles: "[]",
            paymentProofUrl: null,
            proofFileUrl: null,
            proofFileName: null,
            updatedAt: new Date(),
          })
          .where(eq(ordersTable.id, order.id));

        ordersProcessed++;
      }

      return res.json({
        success: true,
        ordersProcessed,
        filesDeleted,
        message:
          ordersProcessed === 0
            ? "No orders older than 3 months with files were found."
            : `Cleaned ${ordersProcessed} order(s) and removed ${filesDeleted} file(s) from cloud storage.`,
      });
    } catch (err: any) {
      req.log.error(err);
      return res
        .status(500)
        .json({ error: "Cleanup failed", details: err?.message });
    }
  },
);

/* ── Logout ───────────────────────────────────────────────────────────────── */
router.post("/logout", (req: Request, res: Response) => {
  clearAuthCookies(res);
  res.json({ success: true, message: "Logged out" });
});

/* ── Session check ───────────────────────────────────────────────────────── */
router.get("/me", (req: Request, res: Response) => {
  const admin = getAdminAuth(req);
  if (admin) {
    res.json({
      authenticated: true,
      username: admin.username,
      role: admin.role,
      permissions: admin.permissions,
      staffId: admin.staffId,
    });
  } else {
    res.status(401).json({ error: "Not authenticated", authenticated: false });
  }
});

/* ── One-time DB migration (creates all tables if missing) ───────────────── */
router.post(
  "/run-migration",
  requireOwner,
  async (req: Request, res: Response) => {
    if (!getAdminAuth(req)) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS "categories" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "description" text DEFAULT '' NOT NULL,
  "image_url" text,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "products" (
  "id" serial PRIMARY KEY NOT NULL,
  "category_id" integer,
  "name" text NOT NULL,
  "description" text DEFAULT '' NOT NULL,
  "price" text DEFAULT '0' NOT NULL,
  "price_type" text DEFAULT 'per_item' NOT NULL,
  "image_url" text,
  "gallery_images" text,
  "artwork_guide_url" text,
  "artwork_guide_name" text,
  "featured" boolean DEFAULT false NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "custom_config" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "services" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "description" text DEFAULT '' NOT NULL,
  "price" text,
  "price_type" text DEFAULT 'custom_quote' NOT NULL,
  "package_details" text,
  "highlights" text DEFAULT '[]' NOT NULL,
  "image_url" text,
  "featured" boolean DEFAULT false NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "category_id" integer,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "service_categories" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "portfolio" (
  "id" serial PRIMARY KEY NOT NULL,
  "title" text NOT NULL,
  "category" text NOT NULL,
  "client_name" text,
  "description" text DEFAULT '' NOT NULL,
  "image_url" text,
  "gallery_images" text DEFAULT '[]' NOT NULL,
  "tags" text DEFAULT '[]' NOT NULL,
  "featured" boolean DEFAULT false NOT NULL,
  "completed_at" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "orders" (
  "id" serial PRIMARY KEY NOT NULL,
  "order_id" text NOT NULL,
  "customer_name" text NOT NULL,
  "customer_phone" text NOT NULL,
  "customer_email" text,
  "customer_address" text NOT NULL,
  "order_type" text DEFAULT 'standard' NOT NULL,
  "items" text DEFAULT '[]' NOT NULL,
  "design_links" text DEFAULT '[]' NOT NULL,
  "attachments" text DEFAULT '[]' NOT NULL,
  "status" text DEFAULT 'submitted' NOT NULL,
  "admin_notes" text,
  "estimated_completion" text,
  "status_history" text DEFAULT '[]' NOT NULL,
  "delivery_method" text,
  "courier_name" text,
  "courier_tracking_number" text,
  "online_delivery_files" text DEFAULT '[]' NOT NULL,
  "online_delivery_links" text DEFAULT '[]' NOT NULL,
  "order_description" text,
  "shipping_method" text,
  "payment_proof_url" text,
  "proof_file_url" text,
  "proof_file_name" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "orders_order_id_unique" UNIQUE("order_id")
);
CREATE TABLE IF NOT EXISTS "reviews" (
  "id" serial PRIMARY KEY NOT NULL,
  "customer_name" text NOT NULL,
  "rating" integer NOT NULL,
  "comment" text NOT NULL,
  "photo_url" text,
  "approved" boolean DEFAULT false NOT NULL,
  "featured" boolean DEFAULT false NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "messages" (
  "id" serial PRIMARY KEY NOT NULL,
  "message_id" text NOT NULL,
  "full_name" text NOT NULL,
  "phone" text NOT NULL,
  "email" text,
  "subject" text NOT NULL,
  "message" text NOT NULL,
  "is_read" boolean DEFAULT false NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "messages_message_id_unique" UNIQUE("message_id")
);
CREATE TABLE IF NOT EXISTS "clients" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "business_name" text,
  "email" text,
  "phone" text,
  "address" text,
  "approved" boolean DEFAULT true NOT NULL,
  "notes" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "notice" (
  "id" serial PRIMARY KEY NOT NULL,
  "enabled" integer DEFAULT 0 NOT NULL,
  "message" text DEFAULT '' NOT NULL,
  "type" text DEFAULT 'info' NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "notices" (
  "id" serial PRIMARY KEY NOT NULL,
  "message" text DEFAULT '' NOT NULL,
  "style" text DEFAULT 'info' NOT NULL,
  "placement" text DEFAULT 'banner' NOT NULL,
  "enabled" integer DEFAULT 1 NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "topic" text,
  "image_url" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "settings" (
  "id" serial PRIMARY KEY NOT NULL,
  "business_name" text DEFAULT 'HAVESTORY' NOT NULL,
  "tagline" text DEFAULT 'Premium Photo Frames & Story Galleries' NOT NULL,
  "hero_title" text DEFAULT 'Premium Printing for Every Vision' NOT NULL,
  "hero_subtitle" text DEFAULT 'From business cards to large banners, we bring your vision to life with precision and care.' NOT NULL,
  "whatsapp_number" text DEFAULT '94700000000' NOT NULL,
  "whatsapp_message" text DEFAULT 'Hi! I''d like to place an order with HAVESTORY.' NOT NULL,
  "about_story" text DEFAULT 'HAVESTORY is your trusted printing partner.' NOT NULL,
  "about_mission" text DEFAULT 'Our mission is simple: to deliver exceptional prints on time, every time.' NOT NULL,
  "about_image" text,
  "orders_completed_count" integer DEFAULT 10 NOT NULL,
  "happy_clients_percent" integer DEFAULT 99 NOT NULL,
  "star_rating" real DEFAULT 5 NOT NULL,
  "facebook_url" text,
  "instagram_url" text,
  "address" text,
  "email" text,
  "phone" text,
  "website" text,
  "bank_name" text,
  "bank_account_holder" text,
  "bank_account_number" text,
  "bank_branch" text,
  "bank_swift_bic" text,
  "payment_due_days" integer DEFAULT 7 NOT NULL,
  "terms_conditions" text,
  "courier_services" text DEFAULT '[]' NOT NULL,
  "hero_bg_image" text,
  "hero_cta_text" text DEFAULT 'Start Your Order' NOT NULL,
  "hero_cta_link" text DEFAULT '/custom-project' NOT NULL,
  "hero_badge_text" text DEFAULT 'Premium Printing in Sri Lanka' NOT NULL,
  "hero_highlight_word" text DEFAULT 'Vision' NOT NULL,
  "about_vision" text,
  "about_founded_year" text DEFAULT '2020' NOT NULL,
  "about_team_size" text DEFAULT '10+' NOT NULL,
  "about_location" text DEFAULT 'Sri Lanka' NOT NULL,
  "privacy_policy" text,
  "terms_of_service" text,
  "seo_title" text DEFAULT 'HAVESTORY — Premium Photo Frames & Story Galleries Sri Lanka' NOT NULL,
  "seo_description" text DEFAULT 'HAVESTORY offers premium custom photo frames in Sri Lanka.' NOT NULL,
  "seo_keywords" text DEFAULT 'printing sri lanka, graphic design, business cards, banners' NOT NULL,
  "seo_og_image" text,
  "theme_preset" text DEFAULT 'pink-purple' NOT NULL,
  "hero_avatar_image1" text,
  "hero_avatar_image2" text,
  "hero_avatar_image3" text,
  "hero_avatar_image4" text,
  "designer_credit" text DEFAULT 'CODEARTIX' NOT NULL,
  "owner_name" text,
  "logo_url" text,
  "tiktok_url" text,
  "bank_details" text DEFAULT '[]' NOT NULL,
  "courier_charge" text DEFAULT '450' NOT NULL,
  "sl_post_charge" text DEFAULT '250' NOT NULL,
  "invoice_standard_rate" text DEFAULT '350' NOT NULL,
  "invoice_express_rate" text DEFAULT '530' NOT NULL,
  "invoice_weight_first_kg" text DEFAULT '450' NOT NULL,
  "invoice_weight_add_kg" text DEFAULT '200' NOT NULL,
  "tagline_enabled" integer DEFAULT 1 NOT NULL,
  "show_name_with_logo" integer DEFAULT 1 NOT NULL,
  "favicon_url" text,
  "whatsapp_order_template" text DEFAULT 'Hi! Your order has been received.' NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "invoices" (
  "id" serial PRIMARY KEY NOT NULL,
  "invoice_number" text NOT NULL,
  "client_name" text NOT NULL,
  "order_id" text,
  "amount" text NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "due_date" text,
  "notes" text,
  "metadata" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "invoices_invoice_number_unique" UNIQUE("invoice_number")
);
CREATE TABLE IF NOT EXISTS "inventory" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "quantity" integer DEFAULT 0 NOT NULL,
  "unit" text DEFAULT 'units' NOT NULL,
  "low_stock_threshold" integer DEFAULT 10 NOT NULL,
  "cost" text,
  "supplier" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "crm_projects" (
  "id" serial PRIMARY KEY NOT NULL,
  "project_id" text NOT NULL,
  "title" text NOT NULL,
  "client_name" text NOT NULL,
  "client_id" integer,
  "service_type_id" integer,
  "status" text DEFAULT 'planning' NOT NULL,
  "description" text,
  "total_value" integer DEFAULT 0,
  "amount_paid" integer DEFAULT 0,
  "start_date" text,
  "due_date" text,
  "notes" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "deleted_at" timestamp,
  CONSTRAINT "crm_projects_project_id_unique" UNIQUE("project_id")
);
  `.trim();

    const ALTER_SQL = `
DO $$ BEGIN
  ALTER TABLE settings ADD COLUMN IF NOT EXISTS hero_slide_image1 text;
EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE settings ADD COLUMN IF NOT EXISTS hero_slide_image2 text;
EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE settings ADD COLUMN IF NOT EXISTS hero_slide_image3 text;
EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE settings ADD COLUMN IF NOT EXISTS hero_slide_image4 text;
EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE settings ADD COLUMN IF NOT EXISTS hero_slide_image5 text;
EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE settings ADD COLUMN IF NOT EXISTS hero_slide_image6 text;
EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE settings ADD COLUMN IF NOT EXISTS hero_slide_image7 text;
EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE settings ADD COLUMN IF NOT EXISTS hero_slide_image8 text;
EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE settings ADD COLUMN IF NOT EXISTS hero_slide_image9 text;
EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE settings ADD COLUMN IF NOT EXISTS hero_slide_image10 text;
EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE settings ADD COLUMN IF NOT EXISTS hero_slide_enabled text NOT NULL DEFAULT '[true,true,true,true,true,true,true,true,true,true]';
EXCEPTION WHEN others THEN NULL; END $$;
  `.trim();

    try {
      const client = await pool.connect();
      await client.query(MIGRATION_SQL);
      await client.query(ALTER_SQL);
      client.release();
      return res.json({
        success: true,
        message: "All tables created and columns updated successfully",
      });
    } catch (err: any) {
      return res
        .status(500)
        .json({ error: "Migration failed", details: err?.message });
    }
  },
);

/* ── Re-link old invoices to clients ─────────────────────────────────────── */
router.post(
  "/backfill-invoice-client-id",
  requireOwner,
  async (req: Request, res: Response) => {
    if (!getAdminAuth(req)) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    try {
      const { summary } = await runInvoiceClientBackfill(db);
      return res.json({ success: true, ...summary });
    } catch (err: any) {
      req.log.error({ err }, "backfill-invoice-client-id failed");
      return res.status(500).json({
        success: false,
        error: "Backfill failed",
        details: err?.message ?? String(err),
      });
    }
  },
);

/* ── Soft-delete helpers ──────────────────────────────────────────────────── */

// Some sections are subsets of another table (e.g. "custom-orders" is the
// `orders` table filtered to orderType === "custom"). The optional
// `extraFilter` is AND-ed into every trash / restore / count predicate so
// only the targeted subset is affected.
type SectionConfig = {
  table:
    | typeof ordersTable
    | typeof invoicesTable
    | typeof clientsTable
    | typeof crmProjectsTable;
  extraFilter?: SQL;
};

const SECTION_MAP: Record<string, SectionConfig> = {
  orders: { table: ordersTable },
  invoices: { table: invoicesTable },
  clients: { table: clientsTable },
  projects: { table: crmProjectsTable },
  // Subset of `orders` — only rows where orderType = 'custom'. Used by the
  // "Clear Custom Projects" action in Settings → Data Management so admins
  // can wipe just the custom-project orders without touching standard ones.
  "custom-orders": {
    table: ordersTable,
    extraFilter: eq(ordersTable.orderType, "custom"),
  },
};

type SectionKey = keyof typeof SECTION_MAP;

function isSectionKey(s: string): s is SectionKey {
  return s in SECTION_MAP;
}

function withExtra(base: SQL, extra?: SQL): SQL {
  return extra ? (and(base, extra) as SQL) : base;
}

/* ── Trash (soft-delete) all items in a section ──────────────────────────── */
router.post(
  "/trash/:section",
  requireOwner,
  async (req: Request, res: Response) => {
    if (!getAdminAuth(req)) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const section = String(req.params.section);
    if (!isSectionKey(section)) {
      return res.status(400).json({ error: `Invalid section: ${section}` });
    }
    try {
      const { table, extraFilter } = SECTION_MAP[section];
      const now = new Date();
      const result = await db
        .update(table)
        .set({ deletedAt: now } as any)
        .where(withExtra(isNull(table.deletedAt), extraFilter));
      const count = (result as any).rowCount ?? 0;
      return res.json({
        success: true,
        trashedCount: count,
        message: `${count} ${section} moved to trash.`,
      });
    } catch (err: any) {
      req.log.error(err);
      return res
        .status(500)
        .json({ error: `Failed to trash ${section}`, details: err?.message });
    }
  },
);

/* ── List trashed items for a section ────────────────────────────────────── */
router.get(
  "/trash/:section",
  requireOwner,
  async (req: Request, res: Response) => {
    if (!getAdminAuth(req)) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const section = String(req.params.section);
    if (!isSectionKey(section)) {
      return res.status(400).json({ error: `Invalid section: ${section}` });
    }
    try {
      const { table, extraFilter } = SECTION_MAP[section];
      const items = await db
        .select()
        .from(table)
        .where(withExtra(isNotNull(table.deletedAt), extraFilter));
      return res.json(items);
    } catch (err: any) {
      req.log.error(err);
      return res
        .status(500)
        .json({
          error: `Failed to fetch trashed ${section}`,
          details: err?.message,
        });
    }
  },
);

/* ── Trash counts for all sections ───────────────────────────────────────── */
router.get(
  "/trash-counts",
  requireOwner,
  async (req: Request, res: Response) => {
    if (!getAdminAuth(req)) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    try {
      const counts: Record<string, number> = {};
      for (const [key, { table, extraFilter }] of Object.entries(SECTION_MAP)) {
        const [row] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(table)
          .where(withExtra(isNotNull(table.deletedAt), extraFilter));
        counts[key] = row?.count ?? 0;
      }
      return res.json(counts);
    } catch (err: any) {
      req.log.error(err);
      return res
        .status(500)
        .json({ error: "Failed to fetch trash counts", details: err?.message });
    }
  },
);

/* ── Restore specific items or all items from trash ──────────────────────── */
router.post(
  "/restore/:section",
  requireOwner,
  async (req: Request, res: Response) => {
    if (!getAdminAuth(req)) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const section = String(req.params.section);
    if (!isSectionKey(section)) {
      return res.status(400).json({ error: `Invalid section: ${section}` });
    }
    try {
      const { table, extraFilter } = SECTION_MAP[section];
      const { ids } = req.body as { ids?: number[] };
      let result: any;
      if (ids && Array.isArray(ids) && ids.length > 0) {
        const idSet = ids.filter(Number.isFinite);
        let restored = 0;
        for (const id of idSet) {
          const r = await db
            .update(table)
            .set({ deletedAt: null } as any)
            .where(withExtra(eq(table.id, id), extraFilter));
          restored += (r as any).rowCount ?? 0;
        }
        result = { restoredCount: restored };
      } else {
        const r = await db
          .update(table)
          .set({ deletedAt: null } as any)
          .where(withExtra(isNotNull(table.deletedAt), extraFilter));
        result = { restoredCount: (r as any).rowCount ?? 0 };
      }
      return res.json({
        success: true,
        ...result,
        message: `${result.restoredCount} ${section} restored from trash.`,
      });
    } catch (err: any) {
      req.log.error(err);
      return res
        .status(500)
        .json({ error: `Failed to restore ${section}`, details: err?.message });
    }
  },
);

/* ── Permanently delete items that have been in trash for over 30 days ──── */
router.post(
  "/purge/:section",
  requireOwner,
  async (req: Request, res: Response) => {
    if (!getAdminAuth(req)) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const section = String(req.params.section);
    if (!isSectionKey(section)) {
      return res.status(400).json({ error: `Invalid section: ${section}` });
    }
    try {
      const { table, extraFilter } = SECTION_MAP[section];
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 30);
      const result = await db
        .delete(table)
        .where(withExtra(lt(table.deletedAt, cutoff), extraFilter));
      const count = (result as any).rowCount ?? 0;
      return res.json({
        success: true,
        purgedCount: count,
        message: `${count} ${section} permanently deleted.`,
      });
    } catch (err: any) {
      req.log.error(err);
      return res
        .status(500)
        .json({ error: `Failed to purge ${section}`, details: err?.message });
    }
  },
);

export default router;
