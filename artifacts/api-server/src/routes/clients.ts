import { Router } from "express";
import { db, pool } from "@workspace/db";
import { clientsTable, crmProjectsTable, invoicesTable } from "@workspace/db/schema";
import { eq, isNull, or, and, desc, sql } from "drizzle-orm";
import { getAdminAuth, hasPermission, requireAdmin, requireOwner } from "../lib/auth-cookie";
import { parseIdParam } from "../lib/parse-id";
import { DuplicateClientPhoneError, findClientIdByPhone, replaceClientPhoneClaims } from "../lib/client-dedupe";

const router = Router();

async function findActiveClientByPhone(phone: unknown) {
  const id = await findClientIdByPhone(phone);
  if (!id) return null;
  const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, id)).limit(1);
  return client && !client.deletedAt ? client : null;
}

async function activeClientById(id: number) {
  const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, id)).limit(1);
  return client && !client.deletedAt ? client : null;
}

// Every client (CRM) route is admin-only.
router.use(requireAdmin);

router.get("/", async (req, res) => {
  try {
    const clients = await db.select().from(clientsTable).where(isNull(clientsTable.deletedAt)).orderBy(clientsTable.createdAt);
    res.setHeader("Cache-Control", "private, max-age=15, stale-while-revalidate=30");
    res.json(clients);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch clients" });
  }
});

// Lightweight list metadata for the Clients screen. The old UI downloaded all
// invoices and CRM projects and then performed an O(clients × records) join in
// the browser. Keep the card payload bounded to one row per client instead.
router.get("/summary", async (req, res) => {
  try {
    const page = Math.max(1, Math.floor(Number(req.query.page) || 1));
    const pageSize = Math.min(60, Math.max(12, Math.floor(Number(req.query.pageSize) || 30)));
    const search = String(req.query.search || "").trim().slice(0, 100);
    const searchPattern = `%${search.replace(/[\\%_]/g, "\\$&")}%`;
    const offset = (page - 1) * pageSize;
    const whereSearch = search
      ? `AND (c.name ILIKE $1 ESCAPE '\\' OR COALESCE(c.business_name,'') ILIKE $1 ESCAPE '\\' OR COALESCE(c.email,'') ILIKE $1 ESCAPE '\\' OR COALESCE(c.phone,'') ILIKE $1 ESCAPE '\\' OR ('C' || LPAD(c.id::text,4,'0')) ILIKE $1 ESCAPE '\\')`
      : "";

    const [pageResult, countResult, statsResult] = await Promise.all([
      pool.query(`
      SELECT c.id,c.name,c.business_name,c.email,c.phone,c.address,c.notes,c.approved,c.created_at,c.updated_at,
        COALESCE(p.project_count,0)::int AS project_count,
        COALESCE(i.invoice_count,0)::int AS invoice_count,
        COALESCE(i.invoiced,0)::numeric AS invoiced,
        COALESCE(i.paid,0)::numeric AS paid
      FROM clients c
      LEFT JOIN LATERAL (
        SELECT COUNT(*) AS project_count FROM crm_projects p
        WHERE p.deleted_at IS NULL AND (p.client_id=c.id OR (p.client_id IS NULL AND LOWER(BTRIM(p.client_name))=LOWER(BTRIM(c.name))))
      ) p ON TRUE
      LEFT JOIN LATERAL (
        SELECT
          COUNT(DISTINCT inv.id) AS invoice_count,
          COALESCE(SUM(COALESCE(NULLIF(REGEXP_REPLACE(inv.amount,'[^0-9.-]','','g'),'')::numeric,0)),0) AS invoiced,
          COALESCE(SUM(CASE
            WHEN LOWER(inv.status)='paid' THEN COALESCE(NULLIF(REGEXP_REPLACE(inv.amount,'[^0-9.-]','','g'),'')::numeric,0)
            WHEN LOWER(inv.status)='partial' AND COALESCE(inv.metadata,'') ~ '^\\s*\\{'
              THEN LEAST(
                COALESCE(NULLIF(REGEXP_REPLACE(inv.amount,'[^0-9.-]','','g'),'')::numeric,0),
                COALESCE(NULLIF((regexp_match(inv.metadata, '"advance"[[:space:]]*:[[:space:]]*"?([0-9]+([.][0-9]+)?)"?'))[1], '')::numeric,0)
              )
            ELSE 0
          END),0) AS paid
        FROM invoices inv
        WHERE inv.deleted_at IS NULL AND (inv.client_id=c.id OR (inv.client_id IS NULL AND LOWER(BTRIM(inv.client_name))=LOWER(BTRIM(c.name))))
      ) i ON TRUE
      WHERE c.deleted_at IS NULL
      ${whereSearch}
      ORDER BY c.created_at DESC
      LIMIT $${search ? 2 : 1} OFFSET $${search ? 3 : 2}
    `, search ? [searchPattern, pageSize, offset] : [pageSize, offset]),
      pool.query(`SELECT COUNT(*)::int AS total FROM clients c WHERE c.deleted_at IS NULL ${whereSearch}`, search ? [searchPattern] : []),
      pool.query(`SELECT COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE NULLIF(BTRIM(business_name),'') IS NOT NULL)::int AS with_business,
        COUNT(*) FILTER (WHERE NULLIF(BTRIM(email),'') IS NOT NULL)::int AS with_email,
        COUNT(*) FILTER (WHERE NULLIF(BTRIM(phone),'') IS NOT NULL)::int AS with_phone
        FROM clients WHERE deleted_at IS NULL`),
    ]);
    const rows = pageResult.rows;
    const total = Number(countResult.rows[0]?.total) || 0;
    const globalStats = statsResult.rows[0] || {};
    res.setHeader("Cache-Control", "private, max-age=15, stale-while-revalidate=30");
    res.json({ items: rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      businessName: row.business_name,
      email: row.email,
      phone: row.phone,
      address: row.address,
      notes: row.notes,
      approved: row.approved,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      projectCount: Number(row.project_count) || 0,
      invoiceCount: Number(row.invoice_count) || 0,
      invoiced: Number(row.invoiced) || 0,
      paid: Number(row.paid) || 0,
    })), total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)), stats: {
      total: Number(globalStats.total) || 0,
      withBusiness: Number(globalStats.with_business) || 0,
      withEmail: Number(globalStats.with_email) || 0,
      withPhone: Number(globalStats.with_phone) || 0,
    }});
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch client summaries" });
  }
});

// Export is intentionally separate from the paginated card endpoint. It is
// only requested on demand and avoids keeping thousands of client objects in
// the browser during normal admin use.
router.get("/export", async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT id,name,business_name,email,phone,address,notes,created_at
      FROM clients WHERE deleted_at IS NULL ORDER BY created_at DESC`);
    res.setHeader("Cache-Control", "no-store, private");
    res.json(rows.map((row: any) => ({
      id: row.id, name: row.name, businessName: row.business_name, email: row.email,
      phone: row.phone, address: row.address, notes: row.notes, createdAt: row.created_at,
    })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to export clients" });
  }
});

function parseInvoiceMetadata(value: unknown): any {
  try { return typeof value === "string" ? JSON.parse(value) : (value || {}); } catch { return {}; }
}

function stripPrivateInvoiceFields(invoice: any): any {
  const meta = parseInvoiceMetadata(invoice?.metadata);
  const clean = {
    ...meta,
    form: meta.form ? { ...meta.form, internalNotes: "" } : meta.form,
    items: Array.isArray(meta.items) ? meta.items.map((item: any) => {
      const { costPrice: _costPrice, costComponents: _costComponents, deductStock: _deductStock, ...publicItem } = item || {};
      return publicItem;
    }) : meta.items,
  };
  return { ...invoice, metadata: JSON.stringify(clean) };
}

// Full linked records are loaded only when an admin opens a client card.
router.get("/:id/activity", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Invalid client id" });
    const [client] = await db.select({ id: clientsTable.id, name: clientsTable.name })
      .from(clientsTable).where(and(eq(clientsTable.id, id), isNull(clientsTable.deletedAt))).limit(1);
    if (!client) return res.status(404).json({ error: "Client not found" });

    const [projects, invoices] = await Promise.all([
      db.select().from(crmProjectsTable)
        .where(and(isNull(crmProjectsTable.deletedAt), or(
          eq(crmProjectsTable.clientId, id),
          and(isNull(crmProjectsTable.clientId), sql`LOWER(BTRIM(${crmProjectsTable.clientName}))=LOWER(BTRIM(${client.name}))`),
        )))
        .orderBy(desc(crmProjectsTable.createdAt)),
      db.select().from(invoicesTable)
        .where(and(isNull(invoicesTable.deletedAt), or(
          eq(invoicesTable.clientId, id),
          and(isNull(invoicesTable.clientId), sql`LOWER(BTRIM(${invoicesTable.clientName}))=LOWER(BTRIM(${client.name}))`),
        )))
        .orderBy(desc(invoicesTable.createdAt)),
    ]);
    const visibleInvoices = hasPermission(getAdminAuth(req), "finance")
      ? invoices
      : invoices.map(stripPrivateInvoiceFields);
    res.setHeader("Cache-Control", "private, max-age=15, stale-while-revalidate=30");
    res.json({ projects, invoices: visibleInvoices });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch client activity" });
  }
});

// Lookup client by phone number (for dedup check from UI or order auto-creation)
router.get("/lookup", async (req, res) => {
  try {
    const { phone } = req.query;
    if (!phone || typeof phone !== "string" || !phone.trim()) {
      return res.status(400).json({ error: "phone query param required" });
    }
    const client = await findActiveClientByPhone(phone);
    if (!client) return res.json(null);
    return res.json(client);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to lookup client" });
  }
});

router.post("/", async (req, res) => {
  const client = await pool.connect();
  try {
    const { name, businessName, email, phone, address, approved = true, notes } = req.body;
    if (!String(name || "").trim()) return res.status(400).json({ error: "Client name is required" });
    await client.query("BEGIN");
    if (phone && String(phone).trim()) {
      const existingId = await findClientIdByPhone(phone, client);
      if (existingId) throw new DuplicateClientPhoneError(existingId);
    }
    const inserted = await client.query(`INSERT INTO clients(name,business_name,email,phone,address,approved,notes)
      VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id`, [
      String(name).trim(), businessName || null, email || null, phone || null, address || null, approved !== false, notes || null,
    ]);
    const id = Number(inserted.rows[0].id);
    await replaceClientPhoneClaims(client, id, phone);
    await client.query("COMMIT");
    const created = await activeClientById(id);
    return res.status(201).json(created);
  } catch (err: any) {
    await client.query("ROLLBACK").catch(() => {});
    if (err instanceof DuplicateClientPhoneError) {
      const existing = await activeClientById(err.existingClientId);
      return res.status(409).json({ error: "This phone number is already linked to an existing client. Duplicate profiles are not allowed.", existingClient: existing });
    }
    req.log.error(err);
    return res.status(500).json({ error: "Failed to create client" });
  } finally { client.release(); }
});

// Upsert by phone — used by the order auto-create flow so online orders always
// produce a client record without creating duplicates.
router.post("/upsert-by-phone", async (req, res) => {
  const client = await pool.connect();
  try {
    const { name, phone, email, address, businessName } = req.body;
    if (!phone || !String(phone).trim()) return res.status(400).json({ error: "phone is required" });
    await client.query("BEGIN");
    const existingId = await findClientIdByPhone(phone, client);
    if (existingId) {
      const current = await client.query("SELECT * FROM clients WHERE id=$1 FOR UPDATE", [existingId]);
      const row = current.rows[0];
      await client.query(`UPDATE clients SET
        name=CASE WHEN COALESCE(name,'')='' AND $2<>'' THEN $2 ELSE name END,
        email=CASE WHEN COALESCE(email,'')='' AND $3<>'' THEN $3 ELSE email END,
        address=CASE WHEN COALESCE(address,'')='' AND $4<>'' THEN $4 ELSE address END,
        business_name=CASE WHEN COALESCE(business_name,'')='' AND $5<>'' THEN $5 ELSE business_name END,
        updated_at=NOW() WHERE id=$1`, [
        existingId, String(name || "").trim(), String(email || "").trim(), String(address || "").trim(), String(businessName || "").trim(),
      ]);
      await client.query("COMMIT");
      return res.json({ client: await activeClientById(existingId), created: false });
    }
    const inserted = await client.query(`INSERT INTO clients(name,phone,email,address,business_name,approved)
      VALUES($1,$2,$3,$4,$5,TRUE) RETURNING id`, [
      String(name || phone).trim(), String(phone).trim(), String(email || "").trim() || null,
      String(address || "").trim() || null, String(businessName || "").trim() || null,
    ]);
    const id=Number(inserted.rows[0].id);
    await replaceClientPhoneClaims(client,id,phone);
    await client.query("COMMIT");
    return res.status(201).json({ client: await activeClientById(id), created: true });
  } catch (err:any) {
    await client.query("ROLLBACK").catch(()=>{});
    if(err instanceof DuplicateClientPhoneError){
      return res.json({client:await activeClientById(err.existingClientId),created:false});
    }
    req.log.error(err);
    return res.status(500).json({ error: "Failed to upsert client" });
  } finally { client.release(); }
});

router.put("/:id", async (req, res) => {
  const client = await pool.connect();
  try {
    const id = parseIdParam(req, res);
    if (id === null) return;
    const { name, businessName, email, phone, address, approved, notes } = req.body;
    await client.query("BEGIN");
    const locked = await client.query("SELECT * FROM clients WHERE id=$1 AND deleted_at IS NULL FOR UPDATE", [id]);
    const existing = locked.rows[0];
    if (!existing) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Client not found" }); }
    const next = {
      name: name !== undefined ? String(name).trim() : existing.name,
      businessName: businessName !== undefined ? (String(businessName || "").trim() || null) : existing.business_name,
      email: email !== undefined ? (String(email || "").trim() || null) : existing.email,
      phone: phone !== undefined ? (String(phone || "").trim() || null) : existing.phone,
      address: address !== undefined ? (String(address || "").trim() || null) : existing.address,
      approved: approved !== undefined ? !!approved : existing.approved,
      notes: notes !== undefined ? (String(notes || "").trim() || null) : existing.notes,
    };
    if (!next.name) { await client.query("ROLLBACK"); return res.status(400).json({ error: "Client name is required" }); }
    await replaceClientPhoneClaims(client, id, next.phone);
    await client.query(`UPDATE clients SET name=$2,business_name=$3,email=$4,phone=$5,address=$6,approved=$7,notes=$8,updated_at=NOW()
      WHERE id=$1`, [id,next.name,next.businessName,next.email,next.phone,next.address,next.approved,next.notes]);
    await client.query("COMMIT");
    return res.json(await activeClientById(id));
  } catch (err: any) {
    await client.query("ROLLBACK").catch(() => {});
    if (err instanceof DuplicateClientPhoneError) {
      const existing = await activeClientById(err.existingClientId);
      return res.status(409).json({ error: "This phone number is already linked to another client. Duplicate profiles are not allowed.", existingClient: existing });
    }
    req.log.error(err);
    return res.status(500).json({ error: "Failed to update client" });
  } finally { client.release(); }
});

router.delete("/:id", requireOwner, async (req, res) => {
  try {
    const id = parseIdParam(req, res);
    if (id === null) return;
    await db.delete(clientsTable).where(eq(clientsTable.id, id));
    res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to delete client" });
  }
});

export default router;
