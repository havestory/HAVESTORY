function esc(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function money(value: unknown) {
  return `Rs. ${Number(value || 0).toLocaleString("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function todayLK() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Colombo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function depositRemark(date = todayLK()) {
  const [year, month, day] = date.split("-");
  return `P${day}${month}${year.slice(-2)}`;
}

function text(el: Element | null) {
  return (el?.textContent || "").replace(/\s+/g, " ").trim();
}

async function api(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    credentials: "include",
    cache: "no-store",
    ...init,
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}

function removeDuplicatePosUi() {
  if (!location.pathname.includes("/admin/pos")) return;

  // Remove remnants produced by the retired injector if SPA navigation kept them alive.
  document.querySelectorAll(
    "[data-pos-report-tools],[data-pos-date-range],[data-pos-day-close],[data-pos-deposit-remark]",
  ).forEach((node) => node.remove());

  // Native POS.tsx owns reports. Remove only duplicated legacy close controls;
  // the enriched close panel below replaces them.
  document.querySelectorAll("button").forEach((button) => {
    if (text(button) !== "Close day") return;
    const wrapper = button.closest("div.flex.gap-2") || button.parentElement;
    wrapper?.remove();
  });
}

async function loadHistory(host: HTMLElement) {
  const from = host.querySelector<HTMLInputElement>("[data-u-pos-from]")?.value || todayLK();
  const to = host.querySelector<HTMLInputElement>("[data-u-pos-to]")?.value || todayLK();
  const status = host.querySelector<HTMLElement>("[data-u-pos-history-status]");
  const body = host.querySelector<HTMLElement>("[data-u-pos-history-body]");
  if (!status || !body) return;
  status.textContent = "Loading bills…";
  body.innerHTML = "";
  try {
    const data = await api(`/api/pos-history/range?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
    status.textContent = `${data.summary.count} bill${data.summary.count === 1 ? "" : "s"} · ${money(data.summary.total)}`;
    if (!data.sales?.length) {
      body.innerHTML = `<div class="u-pos-empty">No POS bills found for this date range.</div>`;
      return;
    }
    const cards = `
      <div class="u-pos-summary-grid">
        <div><span>Bills</span><b>${esc(data.summary.count)}</b></div>
        <div><span>Cash</span><b>${esc(money(data.summary.cash))}</b></div>
        <div><span>Card</span><b>${esc(money(data.summary.card))}</b></div>
        <div><span>Transfer</span><b>${esc(money(data.summary.transfer))}</b></div>
      </div>`;
    const rows = data.sales.map((sale: any) => {
      const when = new Date(sale.sold_at).toLocaleString("en-LK", {
        timeZone: "Asia/Colombo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
      return `<tr><td>${esc(when)}</td><td><b>${esc(sale.receipt_number || "—")}</b></td><td>${esc(sale.invoice_number || "—")}</td><td>${esc(sale.customer_name || "Walk-in customer")}</td><td>${esc(String(sale.payment_method || "—").toUpperCase())}</td><td class="u-pos-money">${esc(money(sale.total))}</td></tr>`;
    }).join("");
    body.innerHTML = `${cards}<div class="u-pos-table-wrap"><table><thead><tr><th>Date / time</th><th>Receipt</th><th>Invoice</th><th>Customer</th><th>Payment</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  } catch (error: any) {
    status.textContent = error.message || "Could not load bill history";
  }
}

function ensureHistory() {
  if (!location.pathname.includes("/admin/pos")) return;
  if (document.querySelector("[data-u-pos-history]")) return;
  const heading = [...document.querySelectorAll("h2")].find((h) => text(h).includes("Today’s issued bills"));
  const todaySection = heading?.closest("section");
  if (!todaySection?.parentElement) return;

  const host = document.createElement("section");
  host.dataset.uPosHistory = "true";
  host.className = "u-pos-card";
  const d = todayLK();
  host.innerHTML = `
    <div class="u-pos-section-head">
      <div>
        <div class="u-pos-eyebrow">POS bill history</div>
        <h2>Check bills from date to date</h2>
        <p>Review counter bills for any custom date range.</p>
      </div>
      <div class="u-pos-history-controls">
        <label>From date<input data-u-pos-from type="date" value="${d}"></label>
        <label>To date<input data-u-pos-to type="date" value="${d}"></label>
        <button data-u-pos-history-go>View bills</button>
      </div>
    </div>
    <div class="u-pos-history-status" data-u-pos-history-status></div>
    <div data-u-pos-history-body></div>`;
  todaySection.parentElement.insertBefore(host, todaySection);
  host.querySelector("[data-u-pos-history-go]")?.addEventListener("click", () => void loadHistory(host));
  void loadHistory(host);
}

function writeDayEndReceipt(win: Window, result: any, width: "58" | "80") {
  const mm = width === "58" ? 58 : 80;
  const s = result.summary || {};
  const session = result.session || {};
  win.document.open();
  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>POS Day End ${esc(result.date)}</title><style>
    @page{size:${mm}mm auto;margin:0}*{box-sizing:border-box}html,body{width:${mm}mm;margin:0;background:#fff;color:#000}body{font-family:Arial,Helvetica,sans-serif;font-size:${width === "58" ? 10 : 11}px;line-height:1.35}.r{padding:${width === "58" ? 3 : 4}mm}.c{text-align:center}.brand{font-size:${width === "58" ? 16 : 19}px;font-weight:900}.rule{border-top:1px dashed #000;margin:2.5mm 0}.row{display:flex;justify-content:space-between;gap:2mm;padding:1mm 0}.bold{font-weight:800}.total{font-size:1.15em;font-weight:900;border-top:1px solid #000;padding-top:1.5mm}.box{border:1px solid #000;padding:2mm;margin-top:2mm}.remark{font-size:1.2em;font-weight:900;letter-spacing:.08em}.small{font-size:.86em;overflow-wrap:anywhere}</style></head><body><main class="r">
    <div class="c brand">HAVESTORY</div><div class="c bold">POS DAY-END SUMMARY</div><div class="c">${esc(result.date)}</div><div class="rule"></div>
    <div class="row"><span>Bills</span><b>${esc(s.bills || 0)}</b></div>
    <div class="row total"><span>Total sales</span><span>${esc(money(s.totalSales))}</span></div>
    <div class="row"><span>Cash sales</span><span>${esc(money(s.cashSales))}</span></div>
    <div class="row"><span>Card sales</span><span>${esc(money(s.cardSales))}</span></div>
    <div class="row"><span>Transfer sales</span><span>${esc(money(s.transferSales))}</span></div>
    <div class="rule"></div>
    <div class="row"><span>Opening float</span><span>${esc(money(s.openingFloat))}</span></div>
    <div class="row"><span>Expected cash</span><b>${esc(money(s.expectedCash))}</b></div>
    <div class="row"><span>Counted cash</span><b>${esc(money(s.countedCash))}</b></div>
    <div class="row"><span>Difference</span><b>${esc(money(s.difference))}</b></div>
    <div class="box"><div class="bold">BANK DEPOSIT</div><div class="row"><span>Deposit amount</span><b>${esc(money(result.depositAmount ?? session.deposit_amount ?? 0))}</b></div><div class="c remark">${esc(result.depositRemark || session.deposit_remark || "")}</div></div>
    ${session.bank_slip_reference ? `<div class="box small"><b>Transaction / slip</b><br>${esc(session.bank_slip_reference)}</div>` : ""}
    ${session.deposit_proof_url ? `<div class="box small"><b>Deposit proof</b><br>${esc(session.deposit_proof_url)}</div>` : ""}
    <div class="box small"><b>System note</b><br>${esc(result.remark || session.closing_remark || "")}</div>
    <div class="rule"></div><div class="c small">Closed by ${esc(session.closed_by || "Admin")}<br>${esc(new Date(session.closed_at || Date.now()).toLocaleString("en-LK", { timeZone: "Asia/Colombo" }))}</div>
  </main></body></html>`);
  win.document.close();
  win.focus();
  window.setTimeout(() => {
    if (!win.closed) win.print();
  }, 300);
}

async function ensureDayEnd() {
  if (!location.pathname.includes("/admin/pos")) return;
  const heading = [...document.querySelectorAll("h2")].find((h) => text(h).includes("Today’s issued bills"));
  const section = heading?.closest("section");
  if (!section) return;

  let day: any;
  try { day = await api(`/api/pos/day?date=${todayLK()}`); } catch { return; }

  const existing = document.querySelector<HTMLElement>("[data-u-pos-day-end]");
  if (existing) {
    const state = existing.dataset.state;
    const nextState = day.session?.closed_at ? "closed" : "open";
    if (state === nextState) return;
    existing.remove();
  }

  const host = document.createElement("div");
  host.dataset.uPosDayEnd = "true";
  host.dataset.state = day.session?.closed_at ? "closed" : "open";
  host.className = "u-pos-day-end";

  if (day.session?.closed_at) {
    host.innerHTML = `
      <div><div class="u-pos-eyebrow">Day-end close</div><b>Counted cash ${esc(money(day.session.closing_cash || 0))}</b><p>${esc(day.session.closing_remark || "POS day is closed.")}</p></div>
      <div class="u-pos-deposit-closed"><span>Bank deposit</span><b>${esc(money(day.session.deposit_amount || 0))}</b><strong>${esc(day.session.deposit_remark || depositRemark(day.date || todayLK()))}</strong></div>`;
  } else {
    const remark = depositRemark(day.date || todayLK());
    host.innerHTML = `
      <div class="u-pos-day-end-title"><div><div class="u-pos-eyebrow">Day-end close</div><h3>Close & approve today</h3><p>Count cash, set the bank deposit amount, then print the day-end summary.</p></div><div class="u-pos-remark-preview"><span>ATM / CDM remark</span><b>${esc(remark)}</b></div></div>
      <div class="u-pos-close-grid">
        <label>Counted cash<input data-u-counted type="number" min="0" step="0.01" placeholder="0.00"></label>
        <label>Bank deposit amount<input data-u-deposit type="number" min="0" step="0.01" placeholder="0.00"></label>
        <label>Transaction / slip no.<input data-u-bank-ref type="text" maxlength="160" placeholder="Optional"></label>
        <label>Deposit proof URL<input data-u-proof type="url" maxlength="500" placeholder="Optional"></label>
        <label>Day-end bill width<select data-u-width><option value="80">80 mm</option><option value="58">58 mm</option></select></label>
        <label class="u-pos-check"><input data-u-tomorrow type="checkbox"> Deposit tomorrow</label>
      </div>
      <div class="u-pos-close-actions"><span data-u-close-status></span><button data-u-close>Close & approve day</button></div>`;

    host.querySelector("[data-u-close]")?.addEventListener("click", async () => {
      const counted = host.querySelector<HTMLInputElement>("[data-u-counted]")?.value || "";
      const depositAmount = host.querySelector<HTMLInputElement>("[data-u-deposit]")?.value || "";
      const status = host.querySelector<HTMLElement>("[data-u-close-status]");
      if (counted === "" || depositAmount === "") {
        if (status) status.textContent = "Enter counted cash and bank deposit amount.";
        return;
      }
      if (!window.confirm("Close and approve today's POS day?")) return;

      // Open synchronously from the click so browser popup blockers cannot suppress it.
      const printWin = window.open("", "_blank", "popup=yes,width=520,height=780");
      if (!printWin) {
        if (status) status.textContent = "Allow pop-ups for this site, then try again.";
        return;
      }
      printWin.document.write("<html><body style='font-family:Arial;padding:24px'>Preparing day-end summary…</body></html>");
      printWin.document.close();

      const button = host.querySelector<HTMLButtonElement>("[data-u-close]");
      if (button) button.disabled = true;
      if (status) status.textContent = "Closing day and preparing print…";
      try {
        const result = await api("/api/pos-day-end/close", {
          method: "POST",
          body: JSON.stringify({
            closingCash: counted,
            depositAmount,
            bankSlipReference: host.querySelector<HTMLInputElement>("[data-u-bank-ref]")?.value || "",
            depositProofUrl: host.querySelector<HTMLInputElement>("[data-u-proof]")?.value || "",
            depositTomorrow: !!host.querySelector<HTMLInputElement>("[data-u-tomorrow]")?.checked,
          }),
        });
        writeDayEndReceipt(printWin, result, (host.querySelector<HTMLSelectElement>("[data-u-width]")?.value || "80") as "58" | "80");
        if (status) status.textContent = `Closed. Deposit ${money(result.depositAmount)} · ${result.depositRemark}`;
        window.setTimeout(() => window.location.reload(), 900);
      } catch (error: any) {
        printWin.document.open();
        printWin.document.write(`<html><body style="font-family:Arial;padding:24px"><h3>Day-end close failed</h3><p>${esc(error.message || "Unknown error")}</p></body></html>`);
        printWin.document.close();
        if (status) status.textContent = error.message || "Could not close POS day";
        if (button) button.disabled = false;
      }
    });
  }

  const table = section.querySelector(".mt-4.overflow-x-auto");
  if (table) section.insertBefore(host, table);
  else section.appendChild(host);
}

let scheduled = false;
function reconcile() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    removeDuplicatePosUi();
    ensureHistory();
    void ensureDayEnd();
  });
}

const observer = new MutationObserver(reconcile);
observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener("popstate", reconcile);
window.addEventListener("hashchange", reconcile);
queueMicrotask(reconcile);
