import { jsPDF } from "jspdf";

function money(value: unknown) {
  return `Rs. ${Number(value || 0).toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function esc(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function todayLK() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Colombo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function buttonText(el: Element) {
  return (el.textContent || "").replace(/\s+/g, " ").trim();
}

async function jsonRequest(url: string, options?: RequestInit) {
  const response = await fetch(url, {
    credentials: "include",
    cache: "no-store",
    ...options,
    headers: options?.body ? { "Content-Type": "application/json" } : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}

function removeLegacyPosControls(root: ParentNode = document) {
  if (!location.pathname.includes("/admin/pos")) return;

  root.querySelectorAll("button").forEach((button) => {
    const text = buttonText(button);
    if (
      text.includes("Add POS-only item") ||
      text.includes("Close item form") ||
      text === "Edit item" ||
      text.includes("Day PDF") ||
      text.includes("Month PDF") ||
      text === "Close day"
    ) {
      const wrapper = button.closest("div.flex.gap-2") || button;
      if (text === "Close day") wrapper.remove();
      else button.remove();
    }
  });

  root.querySelectorAll('input[type="month"][aria-label="POS report month"]').forEach((input) => input.remove());
}

async function loadRange(host: HTMLElement, from: string, to: string) {
  const status = host.querySelector<HTMLElement>("[data-pos-range-status]");
  const results = host.querySelector<HTMLElement>("[data-pos-range-results]");
  if (!status || !results) return;
  status.textContent = "Loading bills…";
  results.innerHTML = "";
  try {
    const data = await jsonRequest(`/api/pos-history/range?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
    status.textContent = `${data.summary.count} bill${data.summary.count === 1 ? "" : "s"} · ${money(data.summary.total)}`;

    const rows = (data.sales || []).map((sale: any) => {
      const when = new Date(sale.sold_at).toLocaleString("en-LK", {
        timeZone: "Asia/Colombo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
      return `<tr class="border-b last:border-0"><td class="px-3 py-3 whitespace-nowrap">${esc(when)}</td><td class="px-3 py-3 font-bold">${esc(sale.receipt_number || "—")}</td><td class="px-3 py-3">${esc(sale.invoice_number || "—")}</td><td class="px-3 py-3">${esc(sale.customer_name || "Walk-in customer")}</td><td class="px-3 py-3 uppercase">${esc(sale.payment_method || "—")}</td><td class="px-3 py-3 text-right font-black">${esc(money(sale.total))}</td></tr>`;
    }).join("");

    results.innerHTML = data.sales?.length
      ? `<div class="grid gap-3 sm:grid-cols-4 mb-4"><div class="rounded-xl border bg-white p-3"><small>Bills</small><b class="block">${esc(data.summary.count)}</b></div><div class="rounded-xl border bg-white p-3"><small>Cash</small><b class="block">${esc(money(data.summary.cash))}</b></div><div class="rounded-xl border bg-white p-3"><small>Card</small><b class="block">${esc(money(data.summary.card))}</b></div><div class="rounded-xl border bg-white p-3"><small>Transfer</small><b class="block">${esc(money(data.summary.transfer))}</b></div></div><div class="overflow-x-auto"><table class="w-full min-w-[760px] text-left text-xs"><thead><tr class="border-b text-[10px] uppercase text-slate-400"><th class="px-3 py-3">Date / time</th><th class="px-3 py-3">Receipt</th><th class="px-3 py-3">Invoice</th><th class="px-3 py-3">Customer</th><th class="px-3 py-3">Payment</th><th class="px-3 py-3 text-right">Total</th></tr></thead><tbody>${rows}</tbody></table></div>`
      : `<div class="py-8 text-center text-sm text-slate-400">No POS bills found for this date range.</div>`;
  } catch (error: any) {
    status.textContent = error.message || "Could not load bill history";
    results.innerHTML = "";
  }
}

function injectDateRange() {
  if (!location.pathname.includes("/admin/pos")) return;
  if (document.querySelector("[data-pos-date-range]")) return;

  const headings = [...document.querySelectorAll("h2")];
  const todayHeading = headings.find((heading) => buttonText(heading).includes("Today’s issued bills"));
  const section = todayHeading?.closest("section");
  if (!section || !section.parentElement) return;

  const host = document.createElement("section");
  host.setAttribute("data-pos-date-range", "true");
  host.className = "rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm";
  const date = todayLK();
  host.innerHTML = `
    <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <div class="text-[10px] font-black uppercase tracking-[.16em] text-violet-700">POS bill history</div>
        <h2 class="mt-1 text-lg font-black text-slate-950">Check bills from date to date</h2>
        <p class="mt-1 text-xs text-slate-500">Choose any date range to review counter bills, including ranges across different months.</p>
      </div>
      <div class="grid gap-2 sm:grid-cols-[170px_170px_auto] sm:items-end">
        <label class="text-[10px] font-black uppercase text-slate-500">From date<input data-pos-from type="date" value="${date}" class="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900" /></label>
        <label class="text-[10px] font-black uppercase text-slate-500">To date<input data-pos-to type="date" value="${date}" class="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900" /></label>
        <button data-pos-apply class="h-11 rounded-xl bg-violet-950 px-5 text-xs font-black text-white">View bills</button>
      </div>
    </div>
    <div data-pos-range-status class="mt-4 text-xs font-bold text-slate-500"></div>
    <div data-pos-range-results class="mt-3"></div>
  `;
  section.parentElement.insertBefore(host, section);

  const apply = () => {
    const from = host.querySelector<HTMLInputElement>("[data-pos-from]")?.value || date;
    const to = host.querySelector<HTMLInputElement>("[data-pos-to]")?.value || date;
    void loadRange(host, from, to);
  };
  host.querySelector("[data-pos-apply]")?.addEventListener("click", apply);
  apply();
}

function saveDayPdf(day: any) {
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const sales = Array.isArray(day.sales) ? day.sales : [];
  const perPage = 24;
  const pages = Math.max(1, Math.ceil(sales.length / perPage));
  for (let page = 0; page < pages; page++) {
    if (page) pdf.addPage();
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(17);
    pdf.text("HAVESTORY — COUNTER SALES", 105, 18, { align: "center" });
    pdf.setFontSize(10);
    pdf.text(`Day-end report · ${day.date} · Page ${page + 1} of ${pages}`, 105, 25, { align: "center" });
    pdf.line(15, 30, 195, 30);
    let y = 39;
    pdf.setFontSize(8);
    pdf.text("TIME", 15, y);
    pdf.text("RECEIPT / INVOICE", 36, y);
    pdf.text("CUSTOMER", 82, y);
    pdf.text("METHOD", 145, y);
    pdf.text("TOTAL", 190, y, { align: "right" });
    pdf.line(15, y + 2, 195, y + 2);
    y += 8;
    for (const sale of sales.slice(page * perPage, (page + 1) * perPage)) {
      pdf.setFont("helvetica", "normal");
      pdf.text(new Date(sale.sold_at).toLocaleTimeString("en-LK", { timeZone: "Asia/Colombo", hour: "2-digit", minute: "2-digit" }), 15, y);
      pdf.text(String(sale.receipt_number || "").slice(0, 22), 36, y);
      pdf.text(String(sale.customer_name || "").slice(0, 30), 82, y);
      pdf.text(String(sale.payment_method || "").toUpperCase(), 145, y);
      pdf.text(money(Number(sale.total)), 190, y, { align: "right" });
      y += 9;
    }
    pdf.line(15, 270, 195, 270);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.text(`Opening float: ${money(Number(day.session?.opening_float || 0))}   Sales: ${money(day.summary?.sales || 0)}   Expected cash: ${money(day.summary?.expectedCash || 0)}`, 105, 278, { align: "center" });
  }
  pdf.save(`HAVESTORY-POS-${day.date}.pdf`);
}

function saveMonthPdf(data: any) {
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const sales = Array.isArray(data.sales) ? data.sales : [];
  const perPage = 23;
  const pages = Math.max(1, Math.ceil(sales.length / perPage));
  for (let page = 0; page < pages; page++) {
    if (page) pdf.addPage();
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(17);
    pdf.text("HAVESTORY — MONTHLY COUNTER SALES", 105, 17, { align: "center" });
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "normal");
    pdf.text(`${data.month} · Page ${page + 1} of ${pages}`, 105, 24, { align: "center" });
    pdf.line(14, 29, 196, 29);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.text(`Bills: ${data.summary?.count || 0}`, 15, 36);
    pdf.text(`Cash: ${money(data.summary?.cash || 0)}`, 48, 36);
    pdf.text(`Card: ${money(data.summary?.card || 0)}`, 98, 36);
    pdf.text(`Transfer: ${money(data.summary?.transfer || 0)}`, 145, 36);
    pdf.setFillColor(47, 22, 56);
    pdf.rect(14, 41, 182, 11, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.text("DATE / TIME", 17, 48);
    pdf.text("RECEIPT / INVOICE", 48, 48);
    pdf.text("CUSTOMER", 101, 48);
    pdf.text("METHOD", 158, 48);
    pdf.text("TOTAL", 192, 48, { align: "right" });
    pdf.setTextColor(20, 20, 20);
    let y = 59;
    for (const sale of sales.slice(page * perPage, (page + 1) * perPage)) {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      const when = new Date(sale.sold_at).toLocaleString("en-LK", { timeZone: "Asia/Colombo", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
      pdf.text(when, 17, y);
      pdf.text(String(sale.receipt_number || "").slice(0, 24), 48, y);
      pdf.text(String(sale.customer_name || "").slice(0, 30), 101, y);
      pdf.text(String(sale.payment_method || "").toUpperCase(), 158, y);
      pdf.text(money(Number(sale.total)), 192, y, { align: "right" });
      pdf.setDrawColor(225, 225, 225);
      pdf.line(14, y + 3, 196, y + 3);
      y += 9;
    }
    pdf.setDrawColor(20, 20, 20);
    pdf.line(14, 274, 196, 274);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.text(`MONTH TOTAL  ${money(data.summary?.total || 0)}`, 192, 282, { align: "right" });
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    pdf.text(`Generated ${new Date().toLocaleString("en-LK", { timeZone: "Asia/Colombo" })} · HAVESTORY`, 15, 282);
  }
  pdf.save(`HAVESTORY-POS-MONTH-${data.month}.pdf`);
}

function injectReportTools() {
  if (!location.pathname.includes("/admin/pos")) return;
  if (document.querySelector("[data-pos-report-tools]")) return;
  const header = [...document.querySelectorAll("header")].find((el) => buttonText(el).includes("POS / Counter Sales"));
  if (!header) return;

  const date = todayLK();
  const host = document.createElement("div");
  host.setAttribute("data-pos-report-tools", "true");
  host.className = "mt-5 grid gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-[150px_110px_auto_165px_auto] sm:items-center";
  host.innerHTML = `
    <input data-pos-report-date type="date" value="${date}" class="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900" aria-label="POS report date" />
    <select data-pos-report-width class="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900" aria-label="POS receipt width"><option value="80">80 mm</option><option value="58">58 mm</option></select>
    <button data-pos-day-pdf class="h-11 rounded-xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-900">Day PDF</button>
    <input data-pos-report-month type="month" value="${date.slice(0, 7)}" class="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900" aria-label="POS report month" />
    <button data-pos-month-pdf class="h-11 rounded-xl bg-violet-950 px-4 text-xs font-black text-white">Month PDF</button>
  `;
  header.appendChild(host);

  host.querySelector("[data-pos-day-pdf]")?.addEventListener("click", async () => {
    const button = host.querySelector<HTMLButtonElement>("[data-pos-day-pdf]");
    const reportDate = host.querySelector<HTMLInputElement>("[data-pos-report-date]")?.value || date;
    if (button) { button.disabled = true; button.textContent = "Preparing…"; }
    try {
      const day = await jsonRequest(`/api/pos/day?date=${encodeURIComponent(reportDate)}`);
      saveDayPdf(day);
    } catch (error: any) {
      window.alert(error.message || "Could not create day PDF");
    } finally {
      if (button) { button.disabled = false; button.textContent = "Day PDF"; }
    }
  });

  host.querySelector("[data-pos-month-pdf]")?.addEventListener("click", async () => {
    const button = host.querySelector<HTMLButtonElement>("[data-pos-month-pdf]");
    const month = host.querySelector<HTMLInputElement>("[data-pos-report-month]")?.value || date.slice(0, 7);
    if (button) { button.disabled = true; button.textContent = "Preparing…"; }
    try {
      const data = await jsonRequest(`/api/pos/month?month=${encodeURIComponent(month)}`);
      saveMonthPdf(data);
    } catch (error: any) {
      window.alert(error.message || "Could not create month PDF");
    } finally {
      if (button) { button.disabled = false; button.textContent = "Month PDF"; }
    }
  });
}

function printDayEndReceipt(result: any, width: "58" | "80") {
  const win = window.open("", "_blank", "popup=yes,width=500,height=760");
  if (!win) {
    window.alert("Please allow pop-ups to print the day-end bill.");
    return;
  }
  const mm = width === "58" ? 58 : 80;
  const s = result.summary || {};
  const session = result.session || {};
  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>POS Day End ${esc(result.date)}</title><style>@page{size:${mm}mm auto;margin:0}*{box-sizing:border-box}html,body{width:${mm}mm;margin:0;background:#fff;color:#000}body{font-family:Arial,Helvetica,sans-serif;font-size:${width === "58" ? 10 : 11}px;line-height:1.35}.r{padding:${width === "58" ? 3 : 4}mm}.c{text-align:center}.brand{font-size:${width === "58" ? 16 : 19}px;font-weight:900}.rule{border-top:1px dashed #000;margin:2.5mm 0}.row{display:flex;justify-content:space-between;gap:2mm;padding:1mm 0}.bold{font-weight:800}.total{font-size:1.15em;font-weight:900;border-top:1px solid #000;margin-top:1mm;padding-top:1.5mm}.remark{margin-top:2mm;border:1px solid #000;padding:2mm;font-size:.9em}.small{font-size:.86em;overflow-wrap:anywhere}</style></head><body><main class="r"><div class="c brand">HAVESTORY</div><div class="c bold">POS DAY-END SUMMARY</div><div class="c">${esc(result.date)}</div><div class="rule"></div><div class="row"><span>Bills</span><b>${esc(s.bills || 0)}</b></div><div class="row total"><span>Total sales</span><span>${esc(money(s.totalSales))}</span></div><div class="row"><span>Cash sales</span><span>${esc(money(s.cashSales))}</span></div><div class="row"><span>Card sales</span><span>${esc(money(s.cardSales))}</span></div><div class="row"><span>Transfer sales</span><span>${esc(money(s.transferSales))}</span></div><div class="rule"></div><div class="row"><span>Opening float</span><span>${esc(money(s.openingFloat))}</span></div><div class="row"><span>Expected cash</span><b>${esc(money(s.expectedCash))}</b></div><div class="row"><span>Counted cash</span><b>${esc(money(s.countedCash))}</b></div><div class="row total"><span>Difference</span><span>${s.difference < 0 ? "-" : s.difference > 0 ? "+" : ""}${esc(money(Math.abs(Number(s.difference || 0))))}</span></div>${session.bank_slip_reference ? `<div class="rule"></div><div class="small"><b>Bank slip / transaction:</b><br>${esc(session.bank_slip_reference)}</div>` : ""}${session.deposit_proof_url ? `<div class="small" style="margin-top:1mm"><b>Deposit proof:</b><br>${esc(session.deposit_proof_url)}</div>` : ""}<div class="small" style="margin-top:1mm"><b>Deposit tomorrow:</b> ${session.deposit_tomorrow ? "YES" : "NO"}</div><div class="remark"><b>System remark</b><br>${esc(result.remark || session.closing_remark || "")}</div><div class="rule"></div><div class="c small">Closed by ${esc(session.closed_by || "Admin")}<br>${esc(new Date(session.closed_at || Date.now()).toLocaleString("en-LK", { timeZone: "Asia/Colombo" }))}</div></main></body></html>`);
  win.document.close();
  win.focus();
  window.setTimeout(() => {
    if (!win.closed) {
      win.print();
      win.close();
    }
  }, 250);
}

async function injectDayClosePanel() {
  if (!location.pathname.includes("/admin/pos")) return;
  if (document.querySelector("[data-pos-day-close]")) return;

  const headings = [...document.querySelectorAll("h2")];
  const todayHeading = headings.find((heading) => buttonText(heading).includes("Today’s issued bills"));
  const section = todayHeading?.closest("section");
  if (!section) return;

  let day: any;
  try {
    day = await jsonRequest(`/api/pos/day?date=${todayLK()}`);
  } catch {
    return;
  }

  const host = document.createElement("div");
  host.setAttribute("data-pos-day-close", "true");
  host.className = "mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4";

  if (day.session?.closed_at) {
    const diff = Number(day.session.closing_difference || 0);
    host.innerHTML = `<div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><div class="text-[10px] font-black uppercase tracking-[.16em] text-violet-700">Day-end close</div><b class="mt-1 block text-sm">Counted cash ${esc(money(day.session.closing_cash || 0))}</b><p class="mt-1 text-xs text-slate-600">${esc(day.session.closing_remark || "POS day is closed.")}</p></div><div class="text-xs font-bold ${diff === 0 ? "text-emerald-700" : "text-amber-700"}">Difference ${diff > 0 ? "+" : diff < 0 ? "-" : ""}${esc(money(Math.abs(diff)))}</div></div>`;
  } else {
    host.innerHTML = `
      <div class="mb-3">
        <div class="text-[10px] font-black uppercase tracking-[.16em] text-violet-700">Day-end close</div>
        <h3 class="mt-1 text-base font-black text-slate-950">Close & approve today</h3>
        <p class="mt-1 text-xs text-slate-500">Closing prints a total-sales bill and creates a system remark automatically.</p>
      </div>
      <div class="grid gap-2 sm:grid-cols-2">
        <input data-pos-closing-cash type="number" min="0" step="0.01" placeholder="Counted cash" class="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900" />
        <input data-pos-bank-ref type="text" maxlength="160" placeholder="Bank slip / transaction no." class="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900" />
        <input data-pos-proof-url type="url" maxlength="500" placeholder="Deposit proof URL (optional)" class="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900" />
        <select data-pos-close-width class="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900"><option value="80">80 mm day-end bill</option><option value="58">58 mm day-end bill</option></select>
      </div>
      <div class="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label class="inline-flex items-center gap-2 text-xs font-bold text-slate-700"><input data-pos-deposit-tomorrow type="checkbox" class="h-4 w-4" /> Deposit tomorrow</label>
        <button data-pos-close-approve class="h-11 rounded-xl bg-violet-950 px-6 text-xs font-black text-white disabled:opacity-40">Close & approve day</button>
      </div>
      <div data-pos-close-status class="mt-2 text-xs font-bold text-slate-500"></div>
    `;

    host.querySelector("[data-pos-close-approve]")?.addEventListener("click", async () => {
      const button = host.querySelector<HTMLButtonElement>("[data-pos-close-approve]");
      const status = host.querySelector<HTMLElement>("[data-pos-close-status]");
      const closingCash = host.querySelector<HTMLInputElement>("[data-pos-closing-cash]")?.value || "";
      const bankSlipReference = host.querySelector<HTMLInputElement>("[data-pos-bank-ref]")?.value || "";
      const depositProofUrl = host.querySelector<HTMLInputElement>("[data-pos-proof-url]")?.value || "";
      const depositTomorrow = !!host.querySelector<HTMLInputElement>("[data-pos-deposit-tomorrow]")?.checked;
      const width = (host.querySelector<HTMLSelectElement>("[data-pos-close-width]")?.value || "80") as "58" | "80";
      if (!closingCash) {
        if (status) status.textContent = "Enter counted cash before closing the day.";
        return;
      }
      if (!window.confirm("Close and approve today's POS day? A day-end sales bill will print immediately.")) return;
      if (button) { button.disabled = true; button.textContent = "Closing…"; }
      if (status) status.textContent = "Checking totals and closing the day…";
      try {
        const result = await jsonRequest("/api/pos-day-end/close", {
          method: "POST",
          body: JSON.stringify({ closingCash, bankSlipReference, depositProofUrl, depositTomorrow }),
        });
        if (status) status.textContent = result.remark || "POS day closed successfully.";
        printDayEndReceipt(result, width);
        window.setTimeout(() => window.location.reload(), 600);
      } catch (error: any) {
        if (status) status.textContent = error.message || "Could not close POS day";
        if (button) { button.disabled = false; button.textContent = "Close & approve day"; }
      }
    });
  }

  const tableWrap = section.querySelector(".mt-4.overflow-x-auto");
  if (tableWrap) section.insertBefore(host, tableWrap);
  else section.appendChild(host);
}

function runPosCleanup() {
  removeLegacyPosControls();
  injectReportTools();
  injectDateRange();
  void injectDayClosePanel();
}

const observer = new MutationObserver(() => runPosCleanup());
observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener("popstate", runPosCleanup);
window.addEventListener("hashchange", runPosCleanup);
queueMicrotask(runPosCleanup);
