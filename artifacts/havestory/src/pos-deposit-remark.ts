function todayLK() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Colombo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function atmRemark(date = todayLK()) {
  const [year, month, day] = date.split("-");
  return `P${day}${month}${year.slice(-2)}`;
}

function mountDepositRemark() {
  if (!location.pathname.includes("/admin/pos")) return;
  const panel = document.querySelector<HTMLElement>("[data-pos-day-close]");
  if (!panel || panel.querySelector("[data-pos-atm-remark]")) return;

  const code = atmRemark();
  const block = document.createElement("div");
  block.setAttribute("data-pos-atm-remark", "true");
  block.className = "mb-3 flex items-center justify-between gap-3 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2.5";
  block.innerHTML = `<div><div class="text-[9px] font-black uppercase tracking-[.12em] text-violet-700">ATM / CDM deposit remark</div><div class="mt-0.5 text-xs text-slate-600">Use this short reference when depositing today’s POS cash.</div></div><code class="shrink-0 rounded-lg bg-white px-3 py-1.5 text-sm font-black text-violet-950">${code}</code>`;

  const firstFormGrid = panel.querySelector(".grid");
  if (firstFormGrid) panel.insertBefore(block, firstFormGrid);
  else panel.appendChild(block);
}

const observer = new MutationObserver(mountDepositRemark);
observer.observe(document.documentElement, { childList: true, subtree: true });
queueMicrotask(mountDepositRemark);
