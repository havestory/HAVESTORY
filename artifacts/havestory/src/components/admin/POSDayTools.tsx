import { useEffect, useRef, useState } from "react";
import { Printer, CheckCircle2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { writeDayEndReceipt } from "@/lib/day-end-print";
const money = (n: unknown) =>
  `Rs. ${Number(n || 0).toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
async function api(url: string, options?: RequestInit) {
  const res = await fetch(url, {
    credentials: "include",
    ...options,
    headers: { "Content-Type": "application/json" },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}
export function POSHistory({
  date,
  revision,
}: {
  date: string;
  revision: string;
}) {
  const [from, setFrom] = useState(date),
    [to, setTo] = useState(date);
  const [range, setRange] = useState({ from: date, to: date });
  const [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setData(null);
    api(
      `/api/pos-history/range?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`,
      { signal: controller.signal },
    )
      .then(setData)
      .catch((err) => {
        if (!controller.signal.aborted) setError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [range, revision]);
  return (
    <section className="u-pos-card">
      <div className="u-pos-section-head">
        <div>
          <div className="u-pos-eyebrow">POS bill history</div>
          <h2>Review your counter sales</h2>
          <p>Choose a date range to view previous bills.</p>
        </div>
        <form
          className="u-pos-history-controls"
          onSubmit={(e) => {
            e.preventDefault();
            if (from > to) {
              setError("From date must be before or equal to the to date.");
              return;
            }
            setRange({ from, to });
          }}
        >
          <label>
            From date
            <input
              required
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label>
            To date
            <input
              required
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
          <button disabled={loading}>View bills</button>
        </form>
      </div>
      <div className="u-pos-history-status" role="status">
        {loading
          ? "Loading bills…"
          : error ||
            `${data?.summary?.count || 0} bills · ${money(data?.summary?.total)}`}
      </div>
      {data && (
        <>
          <div className="u-pos-summary-grid">
            {[
              ["Cash", data.summary.cash],
              ["Card", data.summary.card],
              ["Transfer", data.summary.transfer],
              ["Total", data.summary.total],
            ].map(([label, value]) => (
              <div key={label}>
                <span>{label}</span>
                <b>{money(value)}</b>
              </div>
            ))}
          </div>
          <div className="u-pos-table-wrap">
            <table>
              <thead>
                <tr>
                  {[
                    "Date / time",
                    "Receipt",
                    "Invoice",
                    "Customer",
                    "Payment",
                    "Total",
                  ].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.sales.map((sale: any) => (
                  <tr key={sale.id}>
                    <td>
                      {new Date(sale.sold_at).toLocaleString("en-LK", {
                        timeZone: "Asia/Colombo",
                      })}
                    </td>
                    <td>{sale.receipt_number}</td>
                    <td>{sale.invoice_number || "—"}</td>
                    <td>{sale.customer_name || "Walk-in customer"}</td>
                    <td>{sale.payment_method}</td>
                    <td className="u-pos-money">{money(sale.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data.sales.length && (
              <p className="u-pos-empty">No bills in this date range.</p>
            )}
          </div>
        </>
      )}
    </section>
  );
}
export function POSDayEnd({
  day,
  settings,
  width,
  canClose,
  onClosed,
}: {
  day: any;
  settings: any;
  width: "58" | "80";
  canClose: boolean;
  onClosed: () => Promise<void>;
}) {
  const [cash, setCash] = useState(""),
    [deposit, setDeposit] = useState(""),
    [reference, setReference] = useState(""),
    [proof, setProof] = useState("");
  const [tomorrow, setTomorrow] = useState(false),
    [confirm, setConfirm] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const lock = useRef(false);
  const session = day.session;
  const remark =
    session?.deposit_remark ||
    `P${day.date.slice(8, 10)}${day.date.slice(5, 7)}${day.date.slice(2, 4)}`;
  const print = (result: any) => {
    const win = window.open("", "_blank", "popup=yes,width=520,height=780");
    if (!win) {
      setError("Allow pop-ups, then use Print day-end summary.");
      return;
    }
    writeDayEndReceipt(win, result, width, settings);
  };
  const close = async () => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    const win = window.open("", "_blank", "popup=yes,width=520,height=780");
    try {
      const result = await api("/api/pos-day-end/close", {
        method: "POST",
        body: JSON.stringify({
          closingCash: cash,
          depositAmount: deposit,
          bankSlipReference: reference,
          depositProofUrl: proof,
          depositTomorrow: tomorrow,
        }),
      });
      setConfirm(false);
      if (win) writeDayEndReceipt(win, result, width, settings);
      else
        setError(
          "Day closed. Allow pop-ups and use Print day-end summary to print.",
        );
      await onClosed();
    } catch (err) {
      win?.close();
      setError(err instanceof Error ? err.message : "Could not close the day.");
      setConfirm(false);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  if (!session) return null;
  return (
    <div className="u-pos-day-end">
      <div className="u-pos-day-end-title">
        <div>
          <div className="u-pos-eyebrow">Day-end reconciliation</div>
          <h3>
            {session.closed_at ? "Day closed" : "Count cash & close today"}
          </h3>
          <p>
            {session.closed_at
              ? session.closing_remark
              : "Record counted cash and the amount you plan to deposit."}
          </p>
        </div>
        <div className="u-pos-remark-preview">
          <span>ATM / CDM remark</span>
          <b>{remark}</b>
        </div>
      </div>
      {session.closed_at ? (
        <div className="pos-day-closed">
          <span>
            Counted cash <b>{money(session.closing_cash)}</b>
          </span>
          <span>
            Bank deposit <b>{money(session.deposit_amount)}</b>
          </span>
          <button
            className="pos-secondary"
            onClick={() =>
              print({
                date: day.date,
                session,
                depositRemark: remark,
                depositAmount: session.deposit_amount,
                summary: {
                  bills: day.sales.length,
                  totalSales: day.summary.sales,
                  cashSales: day.summary.cashSales,
                  cardSales: day.sales
                    .filter((s: any) => s.payment_method === "card")
                    .reduce((n: number, s: any) => n + Number(s.total), 0),
                  transferSales: day.sales
                    .filter((s: any) => s.payment_method === "transfer")
                    .reduce((n: number, s: any) => n + Number(s.total), 0),
                  openingFloat: session.opening_float,
                  countedCash: session.closing_cash,
                  expectedCash:
                    session.closing_expected_cash ?? day.summary.expectedCash,
                  difference:
                    session.closing_difference ??
                    Number(session.closing_cash) - day.summary.expectedCash,
                },
              })
            }
          >
            <Printer size={16} /> Print day-end summary
          </button>
        </div>
      ) : canClose ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (
              ![cash, deposit].every(
                (v) => v.trim() && Number.isFinite(Number(v)) && Number(v) >= 0,
              )
            ) {
              setError("Enter valid cash and deposit amounts.");
              return;
            }
            setConfirm(true);
          }}
        >
          <fieldset disabled={busy}>
            <div className="u-pos-close-grid">
              <label>
                Counted cash
                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={cash}
                  onChange={(e) => setCash(e.target.value)}
                  placeholder="0.00"
                />
              </label>
              <label>
                Bank deposit amount
                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={deposit}
                  onChange={(e) => setDeposit(e.target.value)}
                  placeholder="0.00"
                />
              </label>
              <label>
                Transaction / slip no.
                <input
                  maxLength={160}
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="Optional"
                />
              </label>
              <label>
                Deposit proof URL
                <input
                  type="url"
                  maxLength={500}
                  value={proof}
                  onChange={(e) => setProof(e.target.value)}
                  placeholder="Optional"
                />
              </label>
              <label className="u-pos-check">
                <input
                  type="checkbox"
                  checked={tomorrow}
                  onChange={(e) => setTomorrow(e.target.checked)}
                />{" "}
                Deposit tomorrow
              </label>
            </div>
            <div className="u-pos-close-actions">
              <span>Expected cash: {money(day.summary.expectedCash)}</span>
              <button disabled={busy}>Close & approve day</button>
            </div>
          </fieldset>
        </form>
      ) : (
        <p className="pos-helper">
          Day-close permission is required to approve this day.
        </p>
      )}
      {error && (
        <p role="alert" className="pos-form-error">
          {error}
        </p>
      )}
      <Dialog
        open={confirm}
        onOpenChange={(open) => {
          if (!busy) setConfirm(open);
        }}
      >
        <DialogContent className="pos-dialog">
          <DialogTitle>Close today’s POS day?</DialogTitle>
          <DialogDescription>
            Sales will be locked until the owner reopens the day.
          </DialogDescription>
          <div className="pos-quote">
            <span>
              Counted cash<strong>{money(cash)}</strong>
            </span>
            <span>
              Bank deposit<strong>{money(deposit)}</strong>
            </span>
            <span>
              Cash difference
              <strong>{money(Number(cash) - day.summary.expectedCash)}</strong>
            </span>
          </div>
          <div className="pos-dialog-actions">
            <button
              className="pos-secondary"
              disabled={busy}
              onClick={() => setConfirm(false)}
            >
              Cancel
            </button>
            <button className="pos-primary" disabled={busy} onClick={close}>
              <CheckCircle2 size={16} />
              {busy ? "Closing…" : "Approve & print"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
