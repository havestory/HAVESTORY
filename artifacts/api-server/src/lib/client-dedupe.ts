import { pool } from "@workspace/db";

export function normalizeClientPhone(value: unknown): string {
  let digits = String(value || "").replace(/\D+/g, "");
  if (!digits) return "";
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith("94")) return digits.slice(2);
  if (digits.length === 10 && digits.startsWith("0")) return digits.slice(1);
  return digits;
}

export function clientPhoneKeys(value: unknown): string[] {
  const raw = String(value || "").trim();
  if (!raw) return [];
  const parts = raw.split(/[,;\n|/]+/).map(part => part.trim()).filter(Boolean);
  const keys = parts.map(normalizeClientPhone).filter(key => key.length >= 7);
  return [...new Set(keys)];
}

export class DuplicateClientPhoneError extends Error {
  existingClientId: number;
  constructor(existingClientId: number) {
    super("A client with this phone number already exists.");
    this.existingClientId = existingClientId;
  }
}

export async function ensureClientPhoneRegistry(client: any = pool): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS client_phone_keys (
      phone_key TEXT PRIMARY KEY,
      client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS client_phone_keys_client_idx ON client_phone_keys(client_id);
  `);
  const { rows } = await client.query("SELECT id,phone FROM clients WHERE deleted_at IS NULL ORDER BY id");
  for (const row of rows) {
    for (const key of clientPhoneKeys(row.phone)) {
      await client.query(
        "INSERT INTO client_phone_keys(phone_key,client_id) VALUES($1,$2) ON CONFLICT(phone_key) DO NOTHING",
        [key, row.id],
      );
    }
  }
}

export async function findClientIdByPhone(value: unknown, client: any = pool): Promise<number | null> {
  const keys = clientPhoneKeys(value);
  if (!keys.length) return null;
  await ensureClientPhoneRegistry(client);
  const { rows } = await client.query(
    `SELECT k.client_id
       FROM client_phone_keys k
       JOIN clients c ON c.id=k.client_id
       WHERE k.phone_key = ANY($1::text[]) AND c.deleted_at IS NULL
       ORDER BY c.id LIMIT 1`,
    [keys],
  );
  return rows[0] ? Number(rows[0].client_id) : null;
}

export async function replaceClientPhoneClaims(client: any, clientId: number, value: unknown): Promise<void> {
  await ensureClientPhoneRegistry(client);
  const keys = clientPhoneKeys(value);
  for (const key of keys) {
    const locked = await client.query(
      `SELECT k.client_id FROM client_phone_keys k
       JOIN clients c ON c.id=k.client_id
       WHERE k.phone_key=$1 AND c.deleted_at IS NULL
       FOR UPDATE`,
      [key],
    );
    const other = locked.rows[0] ? Number(locked.rows[0].client_id) : null;
    if (other && other !== clientId) throw new DuplicateClientPhoneError(other);
  }
  await client.query("DELETE FROM client_phone_keys WHERE client_id=$1", [clientId]);
  for (const key of keys) {
    try {
      await client.query("INSERT INTO client_phone_keys(phone_key,client_id) VALUES($1,$2)", [key, clientId]);
    } catch (error: any) {
      if (error?.code !== "23505") throw error;
      const owner = await client.query("SELECT client_id FROM client_phone_keys WHERE phone_key=$1", [key]);
      const other = owner.rows[0] ? Number(owner.rows[0].client_id) : 0;
      if (other && other !== clientId) throw new DuplicateClientPhoneError(other);
    }
  }
}
