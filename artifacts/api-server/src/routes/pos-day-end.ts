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
  return `P${day}${month}${year.slice(-2)}`;
};

const money = (value: unknown) =>
  Math.max(0, Number(String(value ?? 0).replace(/[^0-9.-]/g, "")) || 0);

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
    ALTER TABLE pos_sessions ADD COLUMN IF NOT EXISTS closing_remark TEXT;
    ALTER TABLE pos_sessions ADD COLUMN IF NOT EXISTS closing_expected_cash NUMERIC(14,2);
    ALTER TABLE pos_sessions ADD COLUMN IF NOT EXISTS closing_difference NUMERIC(14,2);
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
    const countedCash = money(req.body?.closingCash);
    const bankSlipReference = clean(req.body?.bankSlipReference, 160);
    const depositProofUrl = clean(req.body?.depositProofUrl, 500);
    const depositTomorrow = Boolean(req.body?.depositTomorrow);

    if (req.body?.closingCash === "" || req.body?.closingCash == null) {
      return res.status(400).json({ error: "Counted cash is required" });
    }

    if (depositProofUrl && !/^https?:\/\//i.test(depositProofUrl)) {
      return res.status(400).json({ error: "Deposit proof URL must start with http:// or https://" });
    }

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
       WHERE session_id=$1`,
      [session.id],
    );
    const totals = totalsResult.rows[0];
    const openingFloat = Number(session.opening_float || 0);
    const cashSales = Number(totals.cash_sales || 0);
    const expectedCash = Math.round((openingFloat + cashSales) * 100) / 100;
    const difference = Math.round((countedCash - expectedCash) * 100) / 100;

    let remark = "Cash count matches the expected cash exactly. Day closed successfully.";
    if (difference < -0.009) {
      remark = `Cash shortage of ${rs(Math.abs(difference))} against expected cash.`;
    } else if (difference > 0.009) {
      remark = `Cash overage of ${rs(difference)} against expected cash.`;
    }
    if (bankSlipReference) remark += " Bank slip / transaction reference recorded.";
    if (depositProofUrl) remark += " Deposit proof link recorded.";
    if (depositTomorrow) remark += " Deposit marked for tomorrow.";

    const closed = await client.query(
      `UPDATE pos_sessions
       SET closing_cash=$1,
           bank_slip_reference=$2,
           deposit_proof_url=$3,
           deposit_tomorrow=$4,
           deposit_remark=$5,
           closing_remark=$6,
           closing_expected_cash=$7,
           closing_difference=$8,
           closed_at=NOW(),
           closed_by=$9
       WHERE id=$10 AND closed_at IS NULL
       RETURNING *`,
      [
        countedCash,
        bankSlipReference || null,
        depositProofUrl || null,
        depositTomorrow,
        depositRemark,
        remark,
        expectedCash,
        difference,
        auth.username,
        session.id,
      ],
    );

    if (!closed.rows[0]) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "POS day was already closed" });
    }

    await client.query("COMMIT");
    res.json({
      date,
      depositRemark,
      session: closed.rows[0],
      summary: {
        bills: Number(totals.bill_count || 0),
        totalSales: Number(totals.total_sales || 0),
        cashSales,
        cardSales: Number(totals.card_sales || 0),
        transferSales: Number(totals.transfer_sales || 0),
        openingFloat,
        expectedCash,
        countedCash,
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

export default router;
