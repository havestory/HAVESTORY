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
    const response = await fetch(`/api/pos-history/range?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, {
      credentials: "include",
      cache: "no-store",
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not load bill history");
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

function runPosCleanup() {
  removeLegacyPosControls();
  injectDateRange();
}

const observer = new MutationObserver(() => runPosCleanup());
observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener("popstate", runPosCleanup);
window.addEventListener("hashchange", runPosCleanup);
queueMicrotask(runPosCleanup);
