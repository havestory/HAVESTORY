import type { NextFunction, Request, Response } from "express";
import { pool } from "@workspace/db";
import { getAdminAuth } from "../lib/auth-cookie";
import { queueDeletionRequest } from "../lib/team-access";
import { findClientIdByPhone, replaceClientPhoneClaims } from "../lib/client-dedupe";

async function syncOrderClient(body: any, orderId: string): Promise<void> {
  const phone = String(body?.customerPhone || "").trim();
  if (!phone) return;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    let clientId = await findClientIdByPhone(phone, client);
    if (!clientId) {
      const created = await client.query(`INSERT INTO clients(name,phone,email,address,business_name,approved)
        VALUES($1,$2,$3,$4,$5,TRUE) RETURNING id`, [
        String(body?.customerName || phone).trim(), phone,
        String(body?.customerEmail || "").trim() || null,
        String(body?.customerAddress || "").trim() || null,
        String(body?.customerBusinessName || "").trim() || null,
      ]);
      clientId = Number(created.rows[0].id);
      await replaceClientPhoneClaims(client, clientId, phone);
    } else {
      // Fill missing profile fields from the new order without overwriting
      // information the Owner/staff already saved on the client card.
      await client.query(`UPDATE clients SET
        email=CASE WHEN COALESCE(email,'')='' THEN NULLIF($2,'') ELSE email END,
        address=CASE WHEN COALESCE(address,'')='' THEN NULLIF($3,'') ELSE address END,
        business_name=CASE WHEN COALESCE(business_name,'')='' THEN NULLIF($4,'') ELSE business_name END,
        updated_at=NOW() WHERE id=$1`, [
        clientId, String(body?.customerEmail || "").trim(), String(body?.customerAddress || "").trim(),
        String(body?.customerBusinessName || "").trim(),
      ]);
    }
    await client.query("UPDATE invoices SET client_id=$1 WHERE order_id=$2 AND client_id IS NULL", [clientId, orderId]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally { client.release(); }
}

export async function orderClientAndDeletionMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (req.method === "DELETE") {
    const auth = getAdminAuth(req);
    if (auth?.role === "staff") {
      const segments = String(req.path || "").split("/").filter(Boolean);
      if (segments.length !== 1) {
        res.status(403).json({ error: "Owner approval is required for deleting order attachments or sub-resources" });
        return;
      }
      const raw = segments[0];
      const numeric = Number(raw);
      const result = Number.isFinite(numeric)
        ? await pool.query("SELECT id, order_id, order_type FROM orders WHERE id=$1", [numeric])
        : await pool.query("SELECT id, order_id, order_type FROM orders WHERE order_id=$1", [raw]);
      const order = result.rows[0];
      if (!order) { res.status(404).json({ error: "Order not found" }); return; }
      const targetType = order.order_type === "custom" ? "custom_order" : "order";
      const request = await queueDeletionRequest(req, targetType, order.id, order.order_id, req.body?.reason);
      res.status(202).json({ success: true, pendingApproval: true, message: "Cancellation request sent to Owner", request });
      return;
    }
    next();
    return;
  }

  if (req.method !== "POST" || req.path !== "/") {
    next();
    return;
  }

  const originalJson = res.json.bind(res);
  let completed = false;
  res.json = ((responseBody: any) => {
    if (completed) return res;
    completed = true;
    const orderId = String(responseBody?.orderId || "");
    if (!orderId) return originalJson(responseBody);
    void syncOrderClient(req.body, orderId)
      .catch(error => req.log.error(error, "Order client auto-link failed"))
      .finally(() => originalJson(responseBody));
    return res;
  }) as typeof res.json;
  next();
}
