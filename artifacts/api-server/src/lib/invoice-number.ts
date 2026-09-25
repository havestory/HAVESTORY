import { pool } from "@workspace/db";

let ready: Promise<void> | null = null;

async function ensureCounter() {
  await pool.query(`CREATE TABLE IF NOT EXISTS invoice_number_counter (
    id TEXT PRIMARY KEY,
    last_number INTEGER NOT NULL CHECK (last_number BETWEEN 1000 AND 9999)
  )`);
  await pool.query(`INSERT INTO invoice_number_counter (id, last_number)
    SELECT 'global', COALESCE(MAX(RIGHT(invoice_number, 4)::integer), 1000)
    FROM invoices WHERE invoice_number ~ '^INV-[0-9]{6}-[0-9]{4}$'
    ON CONFLICT (id) DO NOTHING`);
}

/** Allocate one unique four-digit bank reference across all invoice entry points. */
export async function generateInvoiceNumber(): Promise<string> {
  if (!ready) ready = ensureCounter().catch(error => { ready = null; throw error; });
  await ready;
  const dateParts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Colombo", year: "numeric", month: "2-digit" }).formatToParts(new Date());
  const year = dateParts.find(part => part.type === "year")?.value;
  const month = dateParts.find(part => part.type === "month")?.value;
  const prefix = `INV-${year}${month}-`;
  for (let attempt = 0; attempt < 8999; attempt++) {
    const { rows } = await pool.query<{ last_number: number }>(`UPDATE invoice_number_counter
      SET last_number = CASE WHEN last_number >= 9999 THEN 1001 ELSE last_number + 1 END
      WHERE id = 'global' RETURNING last_number`);
    if (!rows[0]) throw new Error("Invoice number counter is missing");
    const candidate = `${prefix}${String(rows[0].last_number).padStart(4, "0")}`;
    const used = await pool.query("SELECT 1 FROM invoices WHERE invoice_number = $1 LIMIT 1", [candidate]);
    if (!used.rowCount) return candidate;
  }
  throw new Error("All bank reference numbers for this month have been used");
}
