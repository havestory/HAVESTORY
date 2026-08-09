import { Router } from "express";
import { db, pool } from "@workspace/db";
import { clientsTable } from "@workspace/db/schema";
import { eq, isNull, or } from "drizzle-orm";
import { requireAdmin, requireOwner } from "../lib/auth-cookie";
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
    res.json(clients);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch clients" });
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
