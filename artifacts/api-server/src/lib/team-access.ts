import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { pool } from "@workspace/db";
import { getAdminAuth, hasPermission } from "./auth-cookie";

export const STAFF_PERMISSIONS = [
  "dashboard", "orders", "customers", "invoices", "shipping",
  "catalog", "products_view", "price_lists_view", "inventory", "production", "website", "finance", "reports",
] as const;
export type StaffPermission = typeof STAFF_PERMISSIONS[number];

export async function ensureTeamTables(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_staff (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      last_login_at TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS admin_activity_log (
      id BIGSERIAL PRIMARY KEY,
      actor_type TEXT NOT NULL,
      actor_id INTEGER,
      actor_username TEXT NOT NULL,
      action TEXT NOT NULL,
      method TEXT NOT NULL,
      path TEXT NOT NULL,
      status_code INTEGER,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS admin_activity_created_idx ON admin_activity_log(created_at DESC);
    CREATE INDEX IF NOT EXISTS admin_activity_actor_idx ON admin_activity_log(actor_id, created_at DESC);
    CREATE TABLE IF NOT EXISTS staff_attendance (
      id BIGSERIAL PRIMARY KEY,
      staff_id INTEGER NOT NULL REFERENCES admin_staff(id) ON DELETE CASCADE,
      attendance_date DATE NOT NULL,
      check_in_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      check_out_at TIMESTAMP WITH TIME ZONE,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
      owner_note TEXT,
      early_checkout BOOLEAN NOT NULL DEFAULT FALSE,
      checkout_note TEXT,
      decided_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      UNIQUE(staff_id, attendance_date)
    );
    ALTER TABLE staff_attendance ADD COLUMN IF NOT EXISTS early_checkout BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE staff_attendance ADD COLUMN IF NOT EXISTS checkout_note TEXT;
    CREATE INDEX IF NOT EXISTS staff_attendance_month_idx ON staff_attendance(attendance_date DESC);
    CREATE INDEX IF NOT EXISTS staff_attendance_status_idx ON staff_attendance(status, attendance_date DESC);
    CREATE TABLE IF NOT EXISTS deletion_approval_requests (
      id BIGSERIAL PRIMARY KEY,
      target_type TEXT NOT NULL CHECK (target_type IN ('invoice','order','custom_order','crm_project')),
      target_id TEXT NOT NULL,
      target_label TEXT NOT NULL,
      reason TEXT,
      requested_by INTEGER REFERENCES admin_staff(id) ON DELETE SET NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
      owner_note TEXT,
      decided_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS deletion_approval_pending_unique
      ON deletion_approval_requests(target_type,target_id) WHERE status='pending';
    CREATE INDEX IF NOT EXISTS deletion_approval_status_idx
      ON deletion_approval_requests(status,created_at DESC);
    CREATE TABLE IF NOT EXISTS staff_production_usage (
      id BIGSERIAL PRIMARY KEY,
      staff_id INTEGER REFERENCES admin_staff(id) ON DELETE SET NULL,
      inventory_item_id INTEGER NOT NULL REFERENCES inventory(id) ON DELETE RESTRICT,
      reference TEXT,
      used_quantity INTEGER NOT NULL DEFAULT 0 CHECK (used_quantity >= 0),
      waste_quantity INTEGER NOT NULL DEFAULT 0 CHECK (waste_quantity >= 0),
      note TEXT,
      usage_date DATE NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      CHECK (used_quantity + waste_quantity > 0)
    );
    CREATE INDEX IF NOT EXISTS staff_production_usage_date_idx ON staff_production_usage(usage_date DESC);
    CREATE INDEX IF NOT EXISTS staff_production_usage_staff_idx ON staff_production_usage(staff_id, usage_date DESC);
  `);
}

export async function queueDeletionRequest(req: Request, targetType: "invoice"|"order"|"custom_order"|"crm_project", targetId: string|number, targetLabel: string, reason?: unknown) {
  const auth = getAdminAuth(req);
  if (!auth || auth.role !== "staff" || !auth.staffId) throw new Error("Staff account required");
  await ensureTeamTables();
  const note = String(reason || "").trim().slice(0, 300) || null;
  const { rows } = await pool.query(`INSERT INTO deletion_approval_requests(target_type,target_id,target_label,reason,requested_by)
    VALUES($1,$2,$3,$4,$5)
    ON CONFLICT (target_type,target_id) WHERE status='pending'
    DO UPDATE SET reason=COALESCE(EXCLUDED.reason,deletion_approval_requests.reason),updated_at=NOW()
    RETURNING *`, [targetType,String(targetId),String(targetLabel).slice(0,160),note,auth.staffId]);
  return rows[0];
}

export function hashStaffPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${derived}`;
}

export function verifyStaffPassword(password: string, stored: string): boolean {
  const [scheme, salt, expected] = String(stored || "").split("$");
  if (scheme !== "scrypt" || !salt || !expected) return false;
  const actual = crypto.scryptSync(password, salt, 64);
  const expectedBuffer = Buffer.from(expected, "hex");
  return actual.length === expectedBuffer.length && crypto.timingSafeEqual(actual, expectedBuffer);
}

const routePermission = (path: string, method: string): StaffPermission | "owner" | null => {
  if (method === "DELETE") {
    // These three resources have an explicit staff -> Owner approval flow.
    if (path.startsWith("/api/orders")) return "orders";
    if (path.startsWith("/api/invoices")) return "invoices";
    if (path.startsWith("/api/crm-projects")) return "customers";
    // No other staff DELETE request is allowed to destroy business data.
    return "owner";
  }
  if (path.startsWith("/api/admin/team") || path.startsWith("/api/admin/activity")) return "owner";
  if (/^\/api\/admin\/(cleanup-files|run-migration|backfill|trash|restore|purge)/.test(path)) return "owner";
  if (path.startsWith("/api/finance-inventory")) return "finance";
  if (path.startsWith("/api/stats")) return "reports";
  if (path.startsWith("/api/orders")) return "orders";
  if (path.startsWith("/api/invoices")) return "invoices";
  if (path.startsWith("/api/clients") || path.startsWith("/api/crm-projects")) return "customers";
  if (path.startsWith("/api/shipping-labels")) return "shipping";
  if (path.startsWith("/api/inventory")) return "inventory";
  if (path.startsWith("/api/products") || path.startsWith("/api/categories")) return method === "GET" ? "products_view" : "owner";
  if (path.startsWith("/api/coupons")) return "owner";
  if (path.startsWith("/api/price-lists")) return method === "GET" ? "price_lists_view" : "owner";
  if (/^\/api\/(services|service-categories|label-calculator)/.test(path)) return "catalog";
  if (/^\/api\/(messages|reviews|notices|notice|portfolio)/.test(path)) return "website";
  if (path.startsWith("/api/settings") && method !== "GET") return "owner";
  return null;
};

export async function staffPermissionGate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const auth = getAdminAuth(req);
  if (!auth || auth.role === "owner") { next(); return; }
  const needed = routePermission(req.path, req.method);
  if (needed === "owner") { res.status(403).json({ error: "Owner access required" }); return; }
  if (needed && !hasPermission(auth, needed)) {
    res.status(403).json({ error: `Access denied. Missing ${needed} permission.` });
    return;
  }
  next();
}

export async function staffActivityLogger(req: Request, res: Response, next: NextFunction): Promise<void> {
  const auth = getAdminAuth(req);
  if (!auth || auth.role !== "staff" || !["POST","PUT","PATCH","DELETE"].includes(req.method)) { next(); return; }
  res.on("finish", () => {
    if (res.statusCode >= 400) return;
    ensureTeamTables().then(() => pool.query(
      `INSERT INTO admin_activity_log(actor_type,actor_id,actor_username,action,method,path,status_code)
       VALUES('staff',$1,$2,$3,$4,$5,$6)`,
      [auth.staffId || null, auth.username, `${req.method} ${req.path}`, req.method, req.path, res.statusCode]
    )).catch(() => {});
  });
  next();
}
