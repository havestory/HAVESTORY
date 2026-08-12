/**
 * Finance report scheduler
 * ─────────────────────────
 * • Starts a 1-hour polling loop at server startup.
 * • On the 1st calendar day of each month it reads the prior month's
 *   finance summary and emails it to the configured recipient.
 * • A module-level sentForMonth guard prevents duplicate sends within
 *   the same process lifecycle (restarts are safe because the check
 *   re-queries the DB for current settings each tick).
 * • The exported sendMonthlyFinanceReport() can also be called from an
 *   API route for on-demand / test sends.
 */

import { pool } from "@workspace/db";
import { getTransport } from "./mailer-transport";

// Track the last month we successfully sent to avoid duplicate sends
// in the same server process.
let _lastSentMonth = "";

function lkrFormat(n: number): string {
  return `LKR ${n.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function esc(s: string | null | undefined): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** ISO month string for the previous calendar month, e.g. "2026-07" */
function prevMonthStr(now = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Human-readable label, e.g. "July 2026" */
function monthLabel(iso: string): string {
  const [y, m] = iso.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleString("en-LK", { month: "long", year: "numeric" });
}

async function fetchSettings(): Promise<{
  enabled: boolean;
  recipient: string;
  businessName: string;
  gmailUser: string | null;
  gmailAppPassword: string | null;
}> {
  const { rows } = await pool.query<{
    finance_report_email_enabled: number;
    finance_report_email_recipient: string | null;
    business_name: string;
    gmail_user: string | null;
    gmail_app_password: string | null;
  }>(
    `SELECT finance_report_email_enabled,
            finance_report_email_recipient,
            business_name,
            gmail_user,
            gmail_app_password
       FROM settings
      WHERE id = 1`
  );
  const row = rows[0];
  return {
    enabled: Boolean(row?.finance_report_email_enabled),
    recipient: (row?.finance_report_email_recipient ?? "").trim(),
    businessName: row?.business_name ?? "HAVESTORY",
    gmailUser: row?.gmail_user ?? null,
    gmailAppPassword: row?.gmail_app_password ?? null,
  };
}

interface FinanceSummary {
  month: string;
  income: number;
  expenses: number;
  netProfit: number;
  currentBalance: number;
  inventoryValue: number;
  lowStockItems: number;
  topCategories: Array<{ category: string; total: number }>;
}

async function fetchFinanceSummary(month: string): Promise<FinanceSummary> {
  const [summary, topCategories] = await Promise.all([
    pool.query<{
      income: string;
      expenses: string;
      current_balance: string;
      inventory_value: string;
      low_stock: string;
    }>(`
      WITH fs AS (SELECT initial_balance FROM finance_settings WHERE id = 1),
           bal AS (
             SELECT COALESCE(SUM(CASE WHEN type='income' THEN amount ELSE -amount END), 0) AS movement
               FROM finance_transactions
              WHERE transaction_date < to_date($1 || '-01', 'YYYY-MM-DD') + INTERVAL '1 month'
           ),
           month_totals AS (
             SELECT
               COALESCE(SUM(CASE WHEN type='income'  THEN amount ELSE 0 END), 0) AS income,
               COALESCE(SUM(CASE WHEN type='expense' THEN amount ELSE 0 END), 0) AS expenses
               FROM finance_transactions
              WHERE transaction_date >= to_date($1 || '-01', 'YYYY-MM-DD')
                AND transaction_date  < to_date($1 || '-01', 'YYYY-MM-DD') + INTERVAL '1 month'
           )
      SELECT
        mt.income,
        mt.expenses,
        (fs.initial_balance + bal.movement)                    AS current_balance,
        COALESCE((SELECT SUM(quantity * CASE WHEN COALESCE(cost,'') ~ '^[0-9]+([.][0-9]+)?$' THEN cost::numeric ELSE 0 END) FROM inventory), 0) AS inventory_value,
        COALESCE((SELECT COUNT(*) FROM inventory WHERE quantity <= low_stock_threshold), 0)                                                       AS low_stock
      FROM month_totals mt, fs, bal
    `, [month]),

    pool.query<{ category: string; total: string }>(`
      SELECT category, SUM(amount) AS total
        FROM finance_transactions
       WHERE transaction_date >= to_date($1 || '-01', 'YYYY-MM-DD')
         AND transaction_date  < to_date($1 || '-01', 'YYYY-MM-DD') + INTERVAL '1 month'
         AND type = 'income'
       GROUP BY category
       ORDER BY total DESC
       LIMIT 5
    `, [month]),
  ]);

  const r = summary.rows[0] ?? { income: "0", expenses: "0", current_balance: "0", inventory_value: "0", low_stock: "0" };
  const income   = Number(r.income);
  const expenses = Number(r.expenses);
  return {
    month,
    income,
    expenses,
    netProfit:      income - expenses,
    currentBalance: Number(r.current_balance),
    inventoryValue: Number(r.inventory_value),
    lowStockItems:  Number(r.low_stock),
    topCategories:  topCategories.rows.map(c => ({ category: c.category, total: Number(c.total) })),
  };
}

function renderReportHtml(s: FinanceSummary, businessName: string, label: string): string {
  const profitColour = s.netProfit >= 0 ? "#16a34a" : "#dc2626";
  const profitSign   = s.netProfit >= 0 ? "+" : "";

  const catRows = s.topCategories.length
    ? s.topCategories.map(c => `
        <tr>
          <td style="padding:8px 12px;font-size:13px;color:#374151;text-transform:capitalize;border-bottom:1px solid #f1f5f9">${esc(c.category.replace(/_/g, " "))}</td>
          <td style="padding:8px 12px;font-size:13px;color:#111827;font-weight:600;text-align:right;border-bottom:1px solid #f1f5f9">${lkrFormat(c.total)}</td>
        </tr>`).join("")
    : `<tr><td colspan="2" style="padding:16px;text-align:center;color:#9ca3af;font-size:13px">No income recorded this month</td></tr>`;

  return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
<div style="max-width:620px;margin:0 auto;background:#ffffff;padding:0">

  <!-- Header -->
  <div style="background:linear-gradient(135deg,#0f0d0a,#1a1510);padding:32px 32px;color:#ffffff;text-align:center">
    <div style="font-size:11px;letter-spacing:3px;color:#c9a84c;text-transform:uppercase;margin-bottom:8px">Monthly Finance Report</div>
    <div style="font-size:28px;font-weight:700;color:#f2ede4">${esc(businessName)}</div>
    <div style="font-size:15px;color:#c9a84c;margin-top:6px;font-weight:600">${esc(label)}</div>
  </div>

  <!-- Gold divider -->
  <div style="height:2px;background:linear-gradient(90deg,transparent,#c9a84c,transparent)"></div>

  <!-- Summary cards -->
  <div style="padding:28px 32px;background:#fafaf8">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">

      <div style="background:#ffffff;border:1px solid #e5e7eb;padding:20px;text-align:center">
        <div style="font-size:10px;letter-spacing:2px;color:#9ca3af;text-transform:uppercase;margin-bottom:6px">Total Income</div>
        <div style="font-size:22px;font-weight:700;color:#16a34a">${lkrFormat(s.income)}</div>
      </div>

      <div style="background:#ffffff;border:1px solid #e5e7eb;padding:20px;text-align:center">
        <div style="font-size:10px;letter-spacing:2px;color:#9ca3af;text-transform:uppercase;margin-bottom:6px">Total Expenses</div>
        <div style="font-size:22px;font-weight:700;color:#dc2626">${lkrFormat(s.expenses)}</div>
      </div>

      <div style="background:#ffffff;border:2px solid ${profitColour};padding:20px;text-align:center">
        <div style="font-size:10px;letter-spacing:2px;color:#9ca3af;text-transform:uppercase;margin-bottom:6px">Net Profit</div>
        <div style="font-size:26px;font-weight:800;color:${profitColour}">${profitSign}${lkrFormat(s.netProfit)}</div>
      </div>

      <div style="background:#ffffff;border:1px solid #e5e7eb;padding:20px;text-align:center">
        <div style="font-size:10px;letter-spacing:2px;color:#9ca3af;text-transform:uppercase;margin-bottom:6px">Current Balance</div>
        <div style="font-size:22px;font-weight:700;color:#1d4ed8">${lkrFormat(s.currentBalance)}</div>
      </div>

    </div>
  </div>

  <!-- Inventory snapshot -->
  <div style="padding:0 32px 28px">
    <div style="background:#fffbeb;border:1px solid #fde68a;padding:16px 20px;display:flex;justify-content:space-between;align-items:center">
      <div>
        <div style="font-size:10px;letter-spacing:2px;color:#92400e;text-transform:uppercase;margin-bottom:4px">Inventory Value</div>
        <div style="font-size:18px;font-weight:700;color:#92400e">${lkrFormat(s.inventoryValue)}</div>
      </div>
      ${s.lowStockItems > 0 ? `
      <div style="background:#fef2f2;border:1px solid #fecaca;padding:10px 16px;text-align:center">
        <div style="font-size:10px;letter-spacing:2px;color:#991b1b;text-transform:uppercase;margin-bottom:2px">Low Stock</div>
        <div style="font-size:20px;font-weight:700;color:#dc2626">${s.lowStockItems}</div>
      </div>` : `
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;padding:10px 16px;text-align:center">
        <div style="font-size:10px;letter-spacing:2px;color:#166534;text-transform:uppercase;margin-bottom:2px">Stock</div>
        <div style="font-size:13px;font-weight:600;color:#16a34a">All OK</div>
      </div>`}
    </div>
  </div>

  <!-- Income by category -->
  ${s.topCategories.length > 0 ? `
  <div style="padding:0 32px 28px">
    <div style="font-size:11px;letter-spacing:2px;color:#6b7280;text-transform:uppercase;margin-bottom:12px;font-weight:600">Income by Category</div>
    <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb">
      <thead>
        <tr style="background:#f9fafb">
          <th style="padding:10px 12px;text-align:left;font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.5px">Category</th>
          <th style="padding:10px 12px;text-align:right;font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.5px">Amount</th>
        </tr>
      </thead>
      <tbody>${catRows}</tbody>
    </table>
  </div>` : ""}

  <!-- Footer -->
  <div style="padding:24px 32px;background:#0f0d0a;text-align:center">
    <div style="font-size:10px;letter-spacing:2px;color:#c9a84c;text-transform:uppercase;margin-bottom:4px">${esc(businessName)}</div>
    <div style="font-size:11px;color:#6b7280">
      Auto-generated on ${new Date().toLocaleString("en-LK", { dateStyle: "long", timeStyle: "short" })}
    </div>
  </div>
</div></body></html>`;
}

function renderReportText(s: FinanceSummary, businessName: string, label: string): string {
  const lines = [
    `${businessName} — Monthly Finance Report`,
    `Period: ${label}`,
    "━".repeat(48),
    `Total Income:     ${lkrFormat(s.income)}`,
    `Total Expenses:   ${lkrFormat(s.expenses)}`,
    `Net Profit:       ${s.netProfit >= 0 ? "+" : ""}${lkrFormat(s.netProfit)}`,
    `Current Balance:  ${lkrFormat(s.currentBalance)}`,
    `Inventory Value:  ${lkrFormat(s.inventoryValue)}`,
    s.lowStockItems > 0 ? `⚠ Low stock items: ${s.lowStockItems}` : "✓ All stock levels OK",
    "",
  ];
  if (s.topCategories.length) {
    lines.push("Income by category:");
    for (const c of s.topCategories) {
      lines.push(`  ${c.category.replace(/_/g, " ").padEnd(24)} ${lkrFormat(c.total)}`);
    }
  }
  lines.push("", `Auto-generated on ${new Date().toLocaleString("en-LK")}`);
  return lines.join("\n");
}

/** Send the finance report for a given month (defaults to prior month). */
export async function sendMonthlyFinanceReport(
  opts: { month?: string; force?: boolean; log?: (m: string) => void } = {}
): Promise<{ sent: boolean; reason?: string }> {
  const log = opts.log ?? console.log;

  const cfg = await fetchSettings();
  if (!cfg.enabled && !opts.force) return { sent: false, reason: "monthly_report_email_disabled" };
  if (!cfg.recipient) return { sent: false, reason: "no_recipient_configured" };

  const transport = getTransport(
    { user: cfg.gmailUser, pass: cfg.gmailAppPassword },
    (msg) => log(msg)
  );
  if (!transport) return { sent: false, reason: "smtp_not_configured" };

  const month  = opts.month ?? prevMonthStr();
  const label  = monthLabel(month);

  let summary: FinanceSummary;
  try {
    summary = await fetchFinanceSummary(month);
  } catch (err) {
    log(`[finance-report] Failed to fetch summary for ${month}: ${err}`);
    return { sent: false, reason: "db_error" };
  }

  const html = renderReportHtml(summary, cfg.businessName, label);
  const text = renderReportText(summary, cfg.businessName, label);

  try {
    await transport.sendMail({
      from: `"${cfg.businessName}" <${cfg.gmailUser ?? ""}>`,
      to: cfg.recipient,
      subject: `${cfg.businessName} — Finance Report · ${label}`,
      html,
      text,
    });
    log(`[finance-report] Monthly report for ${month} sent to ${cfg.recipient}`);
    _lastSentMonth = month;
    return { sent: true };
  } catch (err) {
    log(`[finance-report] Send failed: ${err}`);
    return { sent: false, reason: String(err) };
  }
}

/** Start the hourly cron-like loop. Call once at server startup. */
export function startFinanceReportScheduler(log = console.log): void {
  const tick = async () => {
    const now = new Date();
    // Only fire on the 1st of the month, hours 1–6 (give the month a few
    // hours to settle; avoid midnight race with end-of-month operations)
    if (now.getDate() !== 1 || now.getHours() < 1 || now.getHours() > 6) return;

    const targetMonth = prevMonthStr(now);
    if (_lastSentMonth === targetMonth) return; // already sent this month in this process

    log(`[finance-report] 1st-of-month trigger — sending report for ${targetMonth}`);
    await sendMonthlyFinanceReport({ log });
  };

  // Run immediately in case we started on the 1st
  tick().catch(err => log(`[finance-report] startup tick error: ${err}`));

  // Check every hour
  setInterval(() => {
    tick().catch(err => log(`[finance-report] tick error: ${err}`));
  }, 60 * 60 * 1000);

  log("[finance-report] Scheduler started (checks every hour)");
}
