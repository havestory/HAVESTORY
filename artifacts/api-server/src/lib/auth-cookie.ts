import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";

const COOKIE_PENDING = "pb_pending";
const COOKIE_ADMIN   = "pb_admin";
const PENDING_TTL_MS = 10 * 60 * 1000;  // 10 minutes
const ADMIN_TTL_MS   = 24 * 60 * 60 * 1000; // 24 hours

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("SESSION_SECRET environment variable is required in production");
    }
    return "dev-only-secret-not-for-production";
  }
  return secret;
}

function sign(payload: object, ttlMs: number): string {
  const data = { ...payload, exp: Date.now() + ttlMs };
  const encoded = Buffer.from(JSON.stringify(data)).toString("base64url");
  const sig = crypto.createHmac("sha256", getSecret()).update(encoded).digest("base64url");
  return `${encoded}.${sig}`;
}

function verify(token: string): Record<string, unknown> | null {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot === -1) return null;
  const encoded = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = crypto.createHmac("sha256", getSecret()).update(encoded).digest("base64url");
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  try {
    const data = JSON.parse(Buffer.from(encoded, "base64url").toString()) as Record<string, unknown>;
    if (typeof data.exp === "number" && Date.now() > data.exp) return null;
    return data;
  } catch {
    return null;
  }
}

function cookieOpts(ttlMs: number, isProduction: boolean) {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax" as const,
    maxAge: ttlMs,
    path: "/",
  };
}

const isProduction = process.env.NODE_ENV === "production";

export function setPendingCookie(res: Response, username: string): void {
  res.cookie(COOKIE_PENDING, sign({ pending: true, username }, PENDING_TTL_MS), cookieOpts(PENDING_TTL_MS, isProduction));
}

export type AdminRole = "owner" | "staff";
export type AdminAuth = { username: string; role: AdminRole; staffId?: number; permissions: string[] };

export function setAdminCookie(res: Response, username: string, role: AdminRole = "owner", permissions: string[] = [], staffId?: number): void {
  res.cookie(COOKIE_ADMIN, sign({ isAdmin: true, username, role, permissions, staffId }, ADMIN_TTL_MS), cookieOpts(ADMIN_TTL_MS, isProduction));
}

export function clearAuthCookies(res: Response): void {
  res.clearCookie(COOKIE_PENDING, { path: "/" });
  res.clearCookie(COOKIE_ADMIN,   { path: "/" });
}

export function getPendingAuth(req: Request): { username: string } | null {
  const token = req.cookies?.[COOKIE_PENDING];
  const data = verify(token);
  if (!data?.pending) return null;
  return { username: data.username as string };
}

export function getAdminAuth(req: Request): AdminAuth | null {
  const token = req.cookies?.[COOKIE_ADMIN];
  const data = verify(token);
  if (!data?.isAdmin) return null;
  const role: AdminRole = data.role === "staff" ? "staff" : "owner";
  return {
    username: String(data.username || ""),
    role,
    staffId: typeof data.staffId === "number" ? data.staffId : undefined,
    permissions: Array.isArray(data.permissions) ? data.permissions.map(String) : [],
  };
}

export function hasPermission(auth: AdminAuth | null, permission: string): boolean {
  return !!auth && (auth.role === "owner" || auth.permissions.includes(permission));
}

export function requireOwner(req: Request, res: Response, next: NextFunction): void {
  const auth = getAdminAuth(req);
  if (!auth) { res.status(401).json({ error: "Unauthorized" }); return; }
  if (auth.role !== "owner") { res.status(403).json({ error: "Owner access required" }); return; }
  next();
}

export function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const auth = getAdminAuth(req);
    if (!auth) { res.status(401).json({ error: "Unauthorized" }); return; }
    if (!hasPermission(auth, permission)) { res.status(403).json({ error: `Permission required: ${permission}` }); return; }
    next();
  };
}

/**
 * Express middleware that rejects the request with 401 unless the caller
 * presents a valid admin cookie. Use on every mutating admin route.
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!getAdminAuth(req)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}
