import { Router } from "express";
import { pool } from "@workspace/db";
import { getAdminAuth, hasPermission, requireAdmin } from "../lib/auth-cookie";

const router = Router();
router.use(requireAdmin);
router.use((req, res, next) => {
  const auth = getAdminAuth(req);
  if (!hasPermission(auth, "pos_access")) {
    return res.status(403).json({ error: "POS / Counter Sales access permission required" });
  }
  res.setHeader("Cache-Control", "no-store");
  next();
});

const lkDate = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Colombo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

const depositRemarkFor = (date: string) => {
  const [year, month, day] = date.split("-");
  return `${year.slice(-2)}${month}${day}`;
};

const clean = (value: unknown, max = 300) =>
  String(value ?? "").trim().slice(0, max);

const rs = (value: number) =>
  `Rs. ${Number(value || 0).toLocaleString("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

async function ensureDayEndColumns() {
  await pool.query(`
    ALTER TABLE pos_sessions ADD COLUMN IF NOT EXISTS bank_slip_reference TEXT;
    ALTER TABLE pos_sessions ADD COLUMN IF NOT EXISTS deposit_proof_url TEXT;
    ALTER TABLE pos_sessions ADD COLUMN IF NOT EXISTS deposit_tomorrow BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE pos_sessions ADD COLUMN IF NOT EXISTS deposit_remark TEXT;
    ALTER TABLE pos_sessions ADD COLUMN IF NOT EXISTS deposit_amount NUMERIC(14,2);
    ALTER TABLE pos_sessions ADD COLUMN IF NOT EXISTS closing_remark TEXT;
    ALTER TABLE pos_sessions ADD COLUMN IF NOT EXISTS closing_expected_cash NUMERIC(14,2);
    ALTER TABLE pos_sessions ADD COLUMN IF NOT EXISTS closing_difference NUMERIC(14,2);
    ALTER TABLE pos_sessions ADD COLUMN IF NOT EXISTS next_day_float NUMERIC(14,2);
    CREATE TABLE IF NOT EXISTS pos_bank_deposits (
      id BIGSERIAL PRIMARY KEY,
      session_id INTEGER NOT NULL UNIQUE REFERENCES pos_sessions(id) ON DELETE RESTRICT,
      internal_reference TEXT NOT NULL UNIQUE,
      business_date DATE NOT NULL,
      bank_remark TEXT NOT NULL,
      amount NUMERIC(14,2) NOT NULL CHECK(amount > 0),
      status TEXT NOT NULL CHECK(status IN ('pending','deposited')),
      bank_transaction TEXT,
      proof_url TEXT,
      confirmed_at TIMESTAMP,
      confirmed_by TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS pos_bank_deposits_pending_idx ON pos_bank_deposits(business_date DESC) WHERE status='pending';
  `);
}

router.post("/close", async (req, res) => {
  const client = await pool.connect();
  try {
    const auth = getAdminAuth(req)!;
    if (!hasPermission(auth, "pos_day_close")) {
      return res.status(403).json({ error: "POS day-close permission required" });
    }

    await ensureDayEndColumns();
    const date = lkDate();
    const depositRemark = depositRemarkFor(date);
    const countedCash = Number(req.body?.closingCash);
    const nextDayFloat = Number(req.body?.nextDayFloat);
    const bankSlipReference = clean(req.body?.bankSlipReference, 160);
    const depositProofUrl = clean(req.body?.depositProofUrl, 500);
    const depositTomorrow = Boolean(req.body?.depositTomorrow);

    if (req.body?.closingCash === "" || req.body?.closingCash == null) {
      return res.status(400).json({ error: "Counted cash is required" });
    }
    if (req.body?.nextDayFloat === "" || req.body?.nextDayFloat == null) return res.status(400).json({ error: "Next-day float is required" });
    if (![countedCash, nextDayFloat].every(value => Number.isFinite(value) && value >= 0 && value <= 999999999999.99) || nextDayFloat > countedCash ||
        [countedCash,nextDayFloat].some(value => Math.abs(value * 100 - Math.round(value * 100)) > 1e-6)) {
      return res.status(400).json({ error: "Counted cash and next-day float must be valid amounts; float cannot exceed cash." });
    }
    if (depositProofUrl && !/^https?:\/\//i.test(depositProofUrl)) {
      return res.status(400).json({ error: "Deposit proof URL must start with http:// or https://" });
    }

    const depositAmount = Math.round((countedCash - nextDayFloat) * 100) / 100;
    if (!depositTomorrow && depositAmount > 0 && !bankSlipReference) return res.status(400).json({ error: "Enter a bank transaction reference or choose Deposit Later" });
    await client.query("BEGIN");
    const sessionResult = await client.query(
      `SELECT * FROM pos_sessions
       WHERE business_date=$1 AND closed_at IS NULL
       FOR UPDATE`,
      [date],
    );
    const session = sessionResult.rows[0];
    if (!session) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "No open POS session found" });
    }

    const totalsResult = await client.query(
      `SELECT
         COUNT(*)::int AS bill_count,
         COALESCE(SUM(total),0)::numeric AS total_sales,
         COALESCE(SUM(CASE WHEN payment_method='cash' THEN total ELSE 0 END),0)::numeric AS cash_sales,
         COALESCE(SUM(CASE WHEN payment_method='card' THEN total ELSE 0 END),0)::numeric AS card_sales,
         COALESCE(SUM(CASE WHEN payment_method='transfer' THEN total ELSE 0 END),0)::numeric AS transfer_sales
       FROM pos_sales
       WHERE session_id=$1 AND voided_at IS NULL`,
      [session.id],
    );
    const totals = totalsResult.rows[0];
    const openingFloat = Number(session.opening_float || 0);
    const settlementTotals = await client.query(`SELECT
      COALESCE(SUM(CASE WHEN payment_method='cash' THEN amount ELSE 0 END),0) AS cash,
      COALESCE(SUM(CASE WHEN payment_method='card' THEN amount ELSE 0 END),0) AS card,
      COALESCE(SUM(CASE WHEN payment_method='transfer' THEN amount ELSE 0 END),0) AS transfer
      FROM pos_settlements WHERE session_id=$1`, [session.id]);
    const cashSales = Number(totals.cash_sales || 0) + Number(settlementTotals.rows[0]?.cash || 0);
    const expectedCash = Math.round((openingFloat + cashSales) * 100) / 100;
    const difference = Math.round((countedCash - expectedCash) * 100) / 100;

    let reconciliationRemark = "Cash count matches the expected cash exactly. Day closed successfully.";
    if (difference < -0.009) {
      reconciliationRemark = `Cash shortage of ${rs(Math.abs(difference))} against expected cash.`;
    } else if (difference > 0.009) {
      reconciliationRemark = `Cash overage of ${rs(difference)} against expected cash.`;
    }
    if (bankSlipReference) reconciliationRemark += " Bank slip / transaction reference recorded.";
    if (depositProofUrl) reconciliationRemark += " Deposit proof link recorded.";
    if (depositTomorrow) reconciliationRemark += " Deposit marked for tomorrow.";
    const remark = `ATM/CDM remark: ${depositRemark}. Bank deposit: ${rs(depositAmount)}. ${reconciliationRemark}`;

    const closed = await client.query(
      `UPDATE pos_sessions
       SET closing_cash=$1,
           bank_slip_reference=$2,
           deposit_proof_url=$3,
           deposit_tomorrow=$4,
           deposit_remark=$5,
           deposit_amount=$6,
           closing_remark=$7,
           closing_expected_cash=$8,
           closing_difference=$9,
           next_day_float=$12,
           closed_at=NOW(),
           closed_by=$10
       WHERE id=$11 AND closed_at IS NULL
       RETURNING *`,
      [
        countedCash,
        bankSlipReference || null,
        depositProofUrl || null,
        depositTomorrow,
        depositRemark,
        depositAmount,
        remark,
        expectedCash,
        difference,
        auth.username,
        session.id,
        nextDayFloat,
      ],
    );

    if (!closed.rows[0]) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "POS day was already closed" });
    }

    if (depositAmount > 0) await client.query(`INSERT INTO pos_bank_deposits
      (session_id,internal_reference,business_date,bank_remark,amount,status,bank_transaction,proof_url,confirmed_at,confirmed_by)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      ON CONFLICT(session_id) DO UPDATE SET amount=EXCLUDED.amount,status=EXCLUDED.status,
      bank_transaction=EXCLUDED.bank_transaction,proof_url=EXCLUDED.proof_url,
      confirmed_at=EXCLUDED.confirmed_at,confirmed_by=EXCLUDED.confirmed_by`,
      [session.id, `POS-DEP-${date.replace(/-/g, "")}-${session.id}`, date, depositRemark, depositAmount,
       depositTomorrow ? 'pending' : 'deposited', bankSlipReference || null, depositProofUrl || null,
       depositTomorrow ? null : new Date(), depositTomorrow ? null : auth.username]);
    await client.query("COMMIT");
    res.json({
      date,
      depositRemark,
      depositAmount,
      session: closed.rows[0],
      summary: {
        bills: Number(totals.bill_count || 0),
        totalSales: Number(totals.total_sales || 0),
        cashSales,
        cardSales: Number(totals.card_sales || 0) + Number(settlementTotals.rows[0]?.card || 0),
        transferSales: Number(totals.transfer_sales || 0) + Number(settlementTotals.rows[0]?.transfer || 0),
        openingFloat,
        expectedCash,
        countedCash,
        nextDayFloat,
        depositAmount,
        difference,
      },
      remark,
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    req.log.error(error);
    res.status(500).json({ error: "Could not close POS day" });
  } finally {
    client.release();
  }
});


router.get("/deposits", async (req, res) => {
  try {
    if (getAdminAuth(req)?.role !== "owner") return res.status(403).json({ error: "Owner access required" });
    await ensureDayEndColumns();
    const { rows } = await pool.query(`SELECT id,internal_reference,to_char(business_date,'YYYY-MM-DD') AS business_date,
      bank_remark,amount,status,bank_transaction,proof_url,confirmed_at,confirmed_by
      FROM pos_bank_deposits ORDER BY (status='pending') DESC,business_date DESC,id DESC LIMIT 100`);
    res.json(rows);
  } catch (error) { req.log.error(error); res.status(500).json({ error: "Could not load deposits" }); }
});

router.post("/deposits/:id/confirm", async (req, res) => {
  if (getAdminAuth(req)?.role !== "owner") return res.status(403).json({ error: "Owner access required" });
  const id = Number(req.params.id);
  const bankTransaction = clean(req.body?.bankTransaction, 160);
  const proofUrl = clean(req.body?.proofUrl, 500);
  if (!Number.isSafeInteger(id) || id <= 0 || !bankTransaction || (proofUrl && !/^https?:\/\//i.test(proofUrl)))
    return res.status(400).json({ error: "Enter a valid bank transaction number and optional proof URL" });
  try {
    await ensureDayEndColumns();
    const { rows } = await pool.query(`UPDATE pos_bank_deposits
      SET status='deposited',bank_transaction=$2,proof_url=$3,confirmed_at=NOW(),confirmed_by=$4
      WHERE id=$1 AND status='pending' RETURNING *`, [id,bankTransaction,proofUrl || null,getAdminAuth(req)!.username]);
    if (!rows[0]) return res.status(409).json({ error: "Deposit already confirmed or not found" });
    // Moving cash to a bank is not income; no finance income row is created here.
    res.json(rows[0]);
  } catch (error) { req.log.error(error); res.status(500).json({ error: "Could not confirm deposit" }); }
});

export default router;
