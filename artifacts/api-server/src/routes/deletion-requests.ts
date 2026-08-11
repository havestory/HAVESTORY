import { Router } from "express";
import { pool } from "@workspace/db";
import { requireOwner } from "../lib/auth-cookie";
import { ensureTeamTables } from "../lib/team-access";
import { removeInvoiceFinance, removeInvoiceMaterialUsage } from "./finance-inventory";

const router = Router();
router.use(requireOwner);

router.get("/", async (_req, res) => {
  await ensureTeamTables();
  const { rows } = await pool.query(`SELECT r.*, s.name AS requested_by_name, s.username AS requested_by_username
    FROM deletion_approval_requests r
    LEFT JOIN admin_staff s ON s.id = r.requested_by
    ORDER BY CASE WHEN r.status='pending' THEN 0 ELSE 1 END, r.created_at DESC
    LIMIT 200`);
  res.json(rows);
});

router.post("/:id/decision", async (req, res) => {
  await ensureTeamTables();
  const id = Number(req.params.id);
  const decision = req.body?.decision === "approved" ? "approved" : req.body?.decision === "rejected" ? "rejected" : "";
  if (!Number.isInteger(id) || !decision) return res.status(400).json({ error: "Valid approval decision required" });
  const ownerNote = String(req.body?.note || "").trim().slice(0, 300) || null;
  const client = await pool.connect();
  const removedInvoiceIds: number[] = [];
  try {
    await client.query("BEGIN");
    const locked = await client.query("SELECT * FROM deletion_approval_requests WHERE id=$1 FOR UPDATE", [id]);
    const request = locked.rows[0];
    if (!request) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Deletion request not found" }); }
    if (request.status !== "pending") { await client.query("ROLLBACK"); return res.status(409).json({ error: "This request has already been decided" }); }

    if (decision === "approved") {
      if (request.target_type === "invoice") {
        const removed = await client.query("DELETE FROM invoices WHERE id=$1 RETURNING id", [Number(request.target_id)]);
        if (removed.rows[0]) removedInvoiceIds.push(Number(removed.rows[0].id));
      } else if (request.target_type === "order" || request.target_type === "custom_order") {
        const order = await client.query("SELECT id, order_id FROM orders WHERE id=$1", [Number(request.target_id)]);
        if (order.rows[0]) {
          const invoices = await client.query("DELETE FROM invoices WHERE order_id=$1 RETURNING id", [order.rows[0].order_id]);
          removedInvoiceIds.push(...invoices.rows.map((row: any) => Number(row.id)));
          await client.query("DELETE FROM orders WHERE id=$1", [order.rows[0].id]);
        }
      } else if (request.target_type === "crm_project") {
        await client.query("DELETE FROM crm_projects WHERE id=$1", [Number(request.target_id)]);
      }
    }

    const updated = await client.query(`UPDATE deletion_approval_requests
      SET status=$1, owner_note=$2, decided_at=NOW(), updated_at=NOW()
      WHERE id=$3 RETURNING *`, [decision, ownerNote, id]);
    await client.query("COMMIT");

    for (const invoiceId of removedInvoiceIds) {
      await removeInvoiceFinance(invoiceId).catch(error => req.log.error(error));
      await removeInvoiceMaterialUsage(invoiceId).catch(error => req.log.error(error));
    }
    res.json({ ...updated.rows[0], deleted: decision === "approved" });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    req.log.error(error);
    res.status(500).json({ error: "Could not process deletion request" });
  } finally {
    client.release();
  }
});

export default router;
