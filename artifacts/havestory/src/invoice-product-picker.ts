import { posConfig, quotePosProduct } from "@workspace/api-zod";

type CatalogEntry = {
  key: string;
  id: string | number;
  code?: string;
  name: string;
  kind: "Product" | "Service";
  category?: string;
  price: number;
  customConfig?: string;
};

type PickedLine = {
  key: string;
  productId?: string | number | null;
  description: string;
  qty: number;
  unitPrice: number;
  notes: string;
};

let catalogPromise: Promise<CatalogEntry[]> | null = null;
let activePickedLines: PickedLine[] = [];
let pendingOrderLines: PickedLine[] = [];
let pendingOrderId = "";
let pendingOrderExpiresAt = 0;

function money(value: number) {
  return `Rs. ${Number(value || 0).toLocaleString("en-LK", { maximumFractionDigits: 2 })}`;
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function loadCatalog() {
  if (catalogPromise) return catalogPromise;
  catalogPromise = Promise.all([
    fetch("/api/products", { credentials: "include", cache: "no-store" }).then(r => r.ok ? r.json() : []),
    fetch("/api/services", { credentials: "include", cache: "no-store" }).then(r => r.ok ? r.json() : []),
  ]).then(([products, services]) => {
    const productEntries: CatalogEntry[] = (Array.isArray(products) ? products : [])
      .filter((p: any) => p.active !== false)
      .map((p: any) => ({
        key: `product-${p.id}`,
        id: p.id,
        code: p.code || p.sku || p.itemCode || "",
        name: p.invoiceName || p.name || "Product",
        kind: "Product" as const,
        category: p.category?.name || p.categoryName || "",
        price: Number(p.price || 0),
        customConfig: p.customConfig || "",
      }));
    const serviceEntries: CatalogEntry[] = (Array.isArray(services) ? services : [])
      .filter((s: any) => s.active !== false)
      .map((s: any) => ({
        key: `service-${s.id}`,
        id: s.id,
        code: s.code || s.sku || "",
        name: s.invoiceName || s.name || "Service",
        kind: "Service" as const,
        category: s.categoryName || s.category?.name || "",
        price: Number(s.price || 0),
        customConfig: s.customConfig || "",
      }));
    return [...productEntries, ...serviceEntries];
  });
  return catalogPromise;
}

function needsConfig(item: CatalogEntry) {
  if (item.kind === "Service" && !item.customConfig) return false;
  try {
    const cfg = posConfig(item.customConfig);
    return cfg.productType === "custom_print" || !!cfg.sizes?.length || !!cfg.optionGroups?.some((g: any) => g.choices?.length) || Number(cfg.minQuantity || 1) > 1 || Number(cfg.quantityStep || 1) > 1 || item.price <= 0;
  } catch {
    return item.price <= 0;
  }
}

function setNativeValue(input: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) {
  const proto = input instanceof HTMLInputElement
    ? HTMLInputElement.prototype
    : input instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLSelectElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

async function nextFrame() {
  await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
}

function invoiceRows() {
  return [...document.querySelectorAll<HTMLElement>(".invoice-line-item")];
}

function invoiceRowIsBlank(row: HTMLElement) {
  const desc = row.querySelector<HTMLInputElement>('input[placeholder^="Item "]');
  const price = row.querySelector<HTMLInputElement>('input[inputmode="decimal"]');
  return !desc?.value.trim() && !price?.value.trim();
}

async function ensureInvoiceRow(index: number) {
  let rows = invoiceRows();
  while (rows.length <= index) {
    const add = [...document.querySelectorAll<HTMLButtonElement>("button")].find(b => /Add another item/i.test(b.textContent || ""));
    if (!add) return null;
    add.click();
    await nextFrame();
    rows = invoiceRows();
  }
  return rows[index] || null;
}

async function applyLinesToInvoice(lines: PickedLine[]) {
  if (!lines.length) return;
  const current = invoiceRows();
  let start = current.length === 1 && current[0] && invoiceRowIsBlank(current[0]) ? 0 : current.length;
  for (let i = 0; i < lines.length; i++) {
    const row = await ensureInvoiceRow(start + i);
    if (!row) continue;
    const line = lines[i];
    const description = row.querySelector<HTMLInputElement>('input[placeholder^="Item "]');
    const qty = row.querySelector<HTMLInputElement>('input[inputmode="numeric"]');
    const unitPrice = row.querySelector<HTMLInputElement>('input[aria-label="Unit price"]') || row.querySelector<HTMLInputElement>('input[inputmode="decimal"]');
    const note = row.querySelector<HTMLInputElement>(".invoice-line-note");
    if (description) setNativeValue(description, line.description);
    if (qty) setNativeValue(qty, String(line.qty));
    if (unitPrice) setNativeValue(unitPrice, String(line.unitPrice));
    if (note) setNativeValue(note, line.notes);
    await nextFrame();
  }
}

function applyLinesToOrder(lines: PickedLine[]) {
  if (!lines.length) return;
  const productInput = document.querySelector<HTMLInputElement>('input[placeholder^="e.g. Event Banners"]');
  if (!productInput) return;
  const container = productInput.closest("form") || productInput.closest('[role="dialog"]') || document;
  const priceInput = [...container.querySelectorAll<HTMLInputElement>('input[type="number"]')].find(input => input.placeholder === "0");
  const qtyInput = [...container.querySelectorAll<HTMLInputElement>('input[type="number"]')].find(input => input.min === "1");
  const summary = lines.length === 1 ? lines[0].description : `${lines.length} items · ${lines.map(line => line.description).join(" + ")}`;
  const total = lines.reduce((sum, line) => sum + line.qty * line.unitPrice, 0);
  setNativeValue(productInput, summary);
  if (priceInput) setNativeValue(priceInput, String(total));
  if (qtyInput) setNativeValue(qtyInput, "1");
  pendingOrderLines = lines.map(line => ({ ...line }));
  pendingOrderExpiresAt = Date.now() + 2 * 60 * 1000;
  renderOrderSelectionSummary(productInput, lines, total);
}

function renderOrderSelectionSummary(productInput: HTMLInputElement, lines: PickedLine[], total: number) {
  const host = productInput.closest("form") || productInput.closest('[role="dialog"]');
  if (!host) return;
  host.querySelector("[data-order-catalog-summary]")?.remove();
  const block = document.createElement("div");
  block.setAttribute("data-order-catalog-summary", "true");
  block.className = "invoice-picker-order-summary";
  block.innerHTML = `<div><strong>${lines.length} selected item${lines.length === 1 ? "" : "s"}</strong><span>${escapeHtml(lines.map(l => `${l.description} × ${l.qty}`).join(" · "))}</span></div><b>${escapeHtml(money(total))}</b>`;
  const grid = productInput.closest(".grid");
  grid?.parentElement?.insertBefore(block, grid);
}

function normalizeInvoiceBody(body: any) {
  if (!body || typeof body !== "object") return body;
  let meta: any = {};
  try { meta = typeof body.metadata === "string" ? JSON.parse(body.metadata) : (body.metadata || {}); } catch { meta = {}; }
  const amount = Math.max(0, Number(body.amount || 0) || 0);
  const received = Math.max(0, Number(meta.paymentReceivedTotal ?? meta.paymentReceived ?? meta.advance ?? 0) || 0);
  if (received > amount && amount > 0) {
    meta.paymentReceivedTotal = String(received);
    meta.advance = String(amount);
    meta.customerCredit = String(received - amount);
    meta.overpayment = String(received - amount);
    if (String(body.status || "").toLowerCase() !== "cancelled") body.status = "paid";
    body.metadata = JSON.stringify(meta);
  }
  if (body.orderId && pendingOrderId && String(body.orderId) === String(pendingOrderId) && pendingOrderLines.length && Date.now() < pendingOrderExpiresAt) {
    const total = pendingOrderLines.reduce((sum, line) => sum + line.qty * line.unitPrice, 0);
    const existingMeta = meta || {};
    body.amount = total.toFixed(2);
    body.metadata = JSON.stringify({
      ...existingMeta,
      form: {
        ...(existingMeta.form || {}),
        clientName: body.clientName || existingMeta.form?.clientName || "",
        phone: body.clientPhone || existingMeta.form?.phone || "",
        email: body.clientEmail || existingMeta.form?.email || "",
      },
      items: pendingOrderLines.map(line => ({
        id: crypto.randomUUID(),
        description: line.description,
        qty: line.qty,
        unitPrice: String(line.unitPrice),
        notes: line.notes,
      })),
      shipping: existingMeta.shipping || "none",
      advance: existingMeta.advance || "0",
    });
  }
  return body;
}

function installRequestGuard() {
  const nativeFetch = window.fetch.bind(window);
  if ((window as any).__havestoryInvoiceFetchGuard) return;
  (window as any).__havestoryInvoiceFetchGuard = true;
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.pathname + input.search : input.url;
    const method = String(init?.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
    let nextInit = init;
    if (init?.body && typeof init.body === "string" && method !== "GET") {
      try {
        const parsed = JSON.parse(init.body);
        if (/\/api\/invoices(?:\/\d+)?(?:\?|$)/.test(url)) {
          nextInit = { ...init, body: JSON.stringify(normalizeInvoiceBody(parsed)) };
        } else if (/\/api\/orders(?:\?|$)/.test(url) && method === "POST" && pendingOrderLines.length && Date.now() < pendingOrderExpiresAt) {
          parsed.items = pendingOrderLines.map(line => ({
            productId: line.productId ?? null,
            productName: line.description,
            quantity: line.qty,
            notes: line.notes || null,
            price: String(line.unitPrice),
          }));
          nextInit = { ...init, body: JSON.stringify(parsed) };
        }
      } catch {}
    }
    const response = await nativeFetch(input, nextInit);
    if (/\/api\/orders(?:\?|$)/.test(url) && method === "POST" && response.ok && pendingOrderLines.length) {
      response.clone().json().then((data: any) => {
        pendingOrderId = String(data?.orderId || "");
        pendingOrderExpiresAt = Date.now() + 2 * 60 * 1000;
      }).catch(() => {});
    }
    if (/\/api\/invoices(?:\?|$)/.test(url) && method === "POST" && response.ok && pendingOrderId) {
      pendingOrderLines = [];
      pendingOrderId = "";
      pendingOrderExpiresAt = 0;
    }
    return response;
  };
}

function makeModal() {
  document.querySelector("[data-invoice-product-picker]")?.remove();
  const modal = document.createElement("div");
  modal.setAttribute("data-invoice-product-picker", "true");
  modal.className = "invoice-product-picker-backdrop";
  modal.innerHTML = `
    <div class="invoice-product-picker-shell" role="dialog" aria-modal="true" aria-label="Choose products and services">
      <header class="invoice-product-picker-head">
        <div><span>PRODUCT & SERVICE PICKER</span><h2>Build invoice items</h2><p>Select one or more catalog items. Configured prices, quantity tiers and options are calculated before adding.</p></div>
        <button type="button" data-picker-close aria-label="Close">×</button>
      </header>
      <div class="invoice-product-picker-toolbar">
        <input data-picker-search placeholder="Search product, service, code or category" />
        <select data-picker-kind><option value="all">All</option><option value="Product">Products</option><option value="Service">Services</option></select>
      </div>
      <div class="invoice-product-picker-body">
        <section><div data-picker-results class="invoice-product-picker-results"></div></section>
        <aside class="invoice-product-picker-cart"><div class="invoice-product-picker-cart-head"><div><span>SELECTION</span><b data-picker-count>0 items</b></div><strong data-picker-total>Rs. 0</strong></div><div data-picker-cart-items class="invoice-product-picker-cart-items"></div></aside>
      </div>
      <footer class="invoice-product-picker-foot"><button type="button" data-picker-cancel>Cancel</button><button type="button" data-picker-confirm disabled>Confirm items</button></footer>
    </div>`;
  document.body.appendChild(modal);
  return modal;
}

async function openPicker(mode: "invoice" | "order") {
  const modal = makeModal();
  activePickedLines = [];
  const results = modal.querySelector<HTMLElement>("[data-picker-results]")!;
  const search = modal.querySelector<HTMLInputElement>("[data-picker-search]")!;
  const kind = modal.querySelector<HTMLSelectElement>("[data-picker-kind]")!;
  const close = () => modal.remove();
  modal.querySelector("[data-picker-close]")?.addEventListener("click", close);
  modal.querySelector("[data-picker-cancel]")?.addEventListener("click", close);
  modal.addEventListener("click", e => { if (e.target === modal) close(); });

  let catalog: CatalogEntry[] = [];
  try {
    catalog = await loadCatalog();
  } catch {
    results.innerHTML = `<div class="invoice-picker-empty">Catalog could not load.</div>`;
    return;
  }

  const renderCart = () => {
    const host = modal.querySelector<HTMLElement>("[data-picker-cart-items]")!;
    const total = activePickedLines.reduce((sum, line) => sum + line.qty * line.unitPrice, 0);
    modal.querySelector<HTMLElement>("[data-picker-count]")!.textContent = `${activePickedLines.length} item${activePickedLines.length === 1 ? "" : "s"}`;
    modal.querySelector<HTMLElement>("[data-picker-total]")!.textContent = money(total);
    const confirm = modal.querySelector<HTMLButtonElement>("[data-picker-confirm]")!;
    confirm.disabled = !activePickedLines.length;
    host.innerHTML = activePickedLines.length ? activePickedLines.map((line, index) => `<div class="invoice-picker-cart-row"><div><b>${escapeHtml(line.description)}</b><span>${line.qty} × ${escapeHtml(money(line.unitPrice))}</span></div><strong>${escapeHtml(money(line.qty * line.unitPrice))}</strong><button data-remove-line="${index}" aria-label="Remove">×</button></div>`).join("") : `<div class="invoice-picker-empty">Selected items will appear here.</div>`;
    host.querySelectorAll<HTMLButtonElement>("[data-remove-line]").forEach(button => button.addEventListener("click", () => { activePickedLines.splice(Number(button.dataset.removeLine), 1); renderCart(); }));
  };

  const addSimple = (item: CatalogEntry) => {
    const price = Math.max(0, Number(item.price) || 0);
    if (price <= 0) {
      openConfig(item);
      return;
    }
    activePickedLines.push({ key: `${item.key}-${crypto.randomUUID()}`, productId: item.kind === "Product" ? item.id : null, description: item.name, qty: 1, unitPrice: price, notes: [item.kind, item.category].filter(Boolean).join(" · ") });
    renderCart();
  };

  const openConfig = (item: CatalogEntry) => {
    const existing = modal.querySelector("[data-picker-config]");
    existing?.remove();
    let cfg: any;
    try { cfg = posConfig(item.customConfig); } catch { cfg = { minQuantity: 1, quantityStep: 1, sizes: [], optionGroups: [] }; }
    let qty = Math.max(1, Number(cfg.minQuantity) || 1);
    let sizeId = "";
    const choices: Record<string, string> = {};
    const panel = document.createElement("div");
    panel.setAttribute("data-picker-config", "true");
    panel.className = "invoice-picker-config";
    panel.innerHTML = `<div class="invoice-picker-config-title"><div><span>CONFIGURE ITEM</span><h3>${escapeHtml(item.name)}</h3></div><button type="button" data-config-close>×</button></div><label>Quantity<input data-config-qty type="number" min="1" step="1" value="${qty}" /></label>${cfg.sizes?.length ? `<label>Size<select data-config-size><option value="">Choose size</option>${cfg.sizes.map((s: any) => `<option value="${escapeHtml(s.id)}">${escapeHtml(s.name)}${s.unitLabel ? ` · ${escapeHtml(s.unitLabel)}` : ""}</option>`).join("")}</select></label>` : ""}${(cfg.optionGroups || []).filter((g: any) => g.choices?.length).map((g: any) => `<label>${escapeHtml(g.title)}<select data-config-group="${escapeHtml(g.id)}"><option value="">Choose ${escapeHtml(g.title)}</option>${g.choices.map((c: any) => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}</option>`).join("")}</select></label>`).join("")}<div class="invoice-picker-quote"><span>Calculated price</span><b data-config-quote>Choose options</b></div><button type="button" data-config-add disabled>Add configured item</button>`;
    modal.querySelector(".invoice-product-picker-shell")?.appendChild(panel);
    const quoteEl = panel.querySelector<HTMLElement>("[data-config-quote]")!;
    const addBtn = panel.querySelector<HTMLButtonElement>("[data-config-add]")!;
    const recalc = () => {
      try {
        const quote = quotePosProduct(item.price, item.customConfig, qty, sizeId, choices);
        quoteEl.textContent = `${money(quote.price)} / ${quote.unitLabel || "unit"} · Total ${money(quote.price * qty)}`;
        addBtn.disabled = false;
        addBtn.dataset.unitPrice = String(quote.price);
        addBtn.dataset.description = [item.name, quote.description].filter(Boolean).join(" · ");
        addBtn.dataset.note = [item.kind, item.category, quote.unitLabel].filter(Boolean).join(" · ");
      } catch (error: any) {
        quoteEl.textContent = error?.message || "Choose required options";
        addBtn.disabled = true;
      }
    };
    panel.querySelector<HTMLInputElement>("[data-config-qty]")?.addEventListener("input", e => { qty = Math.max(1, Number((e.target as HTMLInputElement).value) || 1); recalc(); });
    panel.querySelector<HTMLSelectElement>("[data-config-size]")?.addEventListener("change", e => { sizeId = (e.target as HTMLSelectElement).value; const size = cfg.sizes?.find((s: any) => s.id === sizeId); qty = Math.max(1, Number(size?.minQty) || Number(cfg.minQuantity) || 1); const q = panel.querySelector<HTMLInputElement>("[data-config-qty]"); if (q) q.value = String(qty); recalc(); });
    panel.querySelectorAll<HTMLSelectElement>("[data-config-group]").forEach(select => select.addEventListener("change", () => { choices[String(select.dataset.configGroup)] = select.value; recalc(); }));
    panel.querySelector("[data-config-close]")?.addEventListener("click", () => panel.remove());
    addBtn.addEventListener("click", () => {
      activePickedLines.push({ key: `${item.key}-${crypto.randomUUID()}`, productId: item.kind === "Product" ? item.id : null, description: addBtn.dataset.description || item.name, qty, unitPrice: Number(addBtn.dataset.unitPrice || 0), notes: addBtn.dataset.note || item.kind });
      panel.remove();
      renderCart();
    });
    recalc();
  };

  const renderResults = () => {
    const q = search.value.trim().toLowerCase();
    const filter = kind.value;
    const filtered = catalog.filter(item => (filter === "all" || item.kind === filter) && (!q || `${item.code || ""} ${item.name} ${item.category || ""}`.toLowerCase().includes(q)));
    results.innerHTML = filtered.length ? filtered.slice(0, 100).map(item => `<button type="button" class="invoice-picker-product" data-product-key="${escapeHtml(item.key)}"><span class="invoice-picker-product-kind">${escapeHtml(item.kind)}</span><div><b>${escapeHtml(item.name)}</b><span>${escapeHtml([item.code, item.category].filter(Boolean).join(" · "))}</span></div><strong>${needsConfig(item) ? "Choose options" : escapeHtml(money(item.price))}</strong></button>`).join("") : `<div class="invoice-picker-empty">No matching products or services.</div>`;
    results.querySelectorAll<HTMLButtonElement>("[data-product-key]").forEach(button => button.addEventListener("click", () => {
      const item = catalog.find(entry => entry.key === button.dataset.productKey);
      if (!item) return;
      needsConfig(item) ? openConfig(item) : addSimple(item);
    }));
  };
  search.addEventListener("input", renderResults);
  kind.addEventListener("change", renderResults);
  modal.querySelector("[data-picker-confirm]")?.addEventListener("click", async () => {
    const lines = activePickedLines.map(line => ({ ...line }));
    if (mode === "invoice") await applyLinesToInvoice(lines);
    else applyLinesToOrder(lines);
    close();
  });
  renderResults();
  renderCart();
  search.focus();
}

function injectInvoicePickerButton() {
  if (!location.pathname.includes("/admin/invoices")) return;
  document.querySelectorAll<HTMLElement>(".invoice-catalog-panel").forEach(panel => {
    if (panel.dataset.productPickerUpgraded === "true") return;
    panel.dataset.productPickerUpgraded = "true";
    panel.classList.add("invoice-catalog-panel-upgraded");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "invoice-open-product-picker";
    button.innerHTML = `<span>＋</span><div><b>Choose products & services</b><small>Select multiple catalog items, quantities, tiers and options in one window.</small></div><strong>Open picker</strong>`;
    button.addEventListener("click", () => void openPicker("invoice"));
    panel.parentElement?.insertBefore(button, panel);
  });
}

function injectOrderPickerButton() {
  if (!location.pathname.includes("/admin/orders")) return;
  document.querySelectorAll<HTMLInputElement>('input[placeholder^="e.g. Event Banners"]').forEach(input => {
    const form = input.closest("form") || input.closest('[role="dialog"]');
    if (!form || form.querySelector("[data-order-product-picker-button]")) return;
    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute("data-order-product-picker-button", "true");
    button.className = "invoice-open-product-picker order-product-picker-button";
    button.innerHTML = `<span>＋</span><div><b>Build product list</b><small>Use the same catalog picker for the order and its new invoice.</small></div><strong>Choose items</strong>`;
    button.addEventListener("click", () => void openPicker("order"));
    const grid = input.closest(".grid");
    grid?.parentElement?.insertBefore(button, grid);
  });
}

function installOverpaymentHint() {
  if (!location.pathname.includes("/admin/invoices")) return;
  const modal = document.querySelector<HTMLElement>(".invoice-modal-section");
  if (!modal) return;
  const advanceLabel = [...document.querySelectorAll<HTMLElement>("span")].find(el => el.textContent?.trim() === "Advance Payment");
  const section = advanceLabel?.closest<HTMLElement>("section.invoice-modal-section");
  if (!section || section.querySelector("[data-overpayment-hint]")) return;
  const input = section.querySelector<HTMLInputElement>('input[inputmode="decimal"]');
  if (!input) return;
  const hint = document.createElement("div");
  hint.setAttribute("data-overpayment-hint", "true");
  hint.className = "invoice-overpayment-hint";
  section.appendChild(hint);
  const update = () => {
    const received = Math.max(0, Number(input.value) || 0);
    const totalText = [...section.querySelectorAll<HTMLElement>("span")].find(el => /Grand Total/i.test(el.textContent || ""))?.parentElement?.textContent || "";
    const total = Number((totalText.match(/[\d,.]+/)?.[0] || "0").replace(/,/g, "")) || 0;
    const credit = Math.max(0, received - total);
    hint.innerHTML = credit > 0 ? `<b>Overpayment accepted</b><span>${escapeHtml(money(total))} will settle this invoice and ${escapeHtml(money(credit))} will be stored as customer credit.</span>` : "";
    hint.style.display = credit > 0 ? "flex" : "none";
  };
  input.addEventListener("input", update);
  update();
}

function runEnhancements() {
  injectInvoicePickerButton();
  injectOrderPickerButton();
  installOverpaymentHint();
}

installRequestGuard();
const observer = new MutationObserver(() => runEnhancements());
observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener("popstate", runEnhancements);
window.addEventListener("hashchange", runEnhancements);
queueMicrotask(runEnhancements);
