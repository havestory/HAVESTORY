import { defaultPOSBank } from "@workspace/api-zod";
import { bankPrintHTML, escapePrint as esc } from "./bank-print";
const money = (value: unknown) =>
  `Rs. ${Number(value || 0).toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export function writeDayEndReceipt(
  win: Window,
  result: any,
  width: "58" | "80",
  settings?: any,
) {
  const mm = width === "58" ? 58 : 80;
  const s = result.summary || {};
  const session = result.session || {};
  win.document.open();
  win.document
    .write(`<!doctype html><html><head><meta charset="utf-8"><title>POS Day End ${esc(result.date)}</title><style>
    @page{size:${mm}mm auto;margin:0}*{box-sizing:border-box}html,body{width:${mm}mm;margin:0;background:#fff;color:#000}body{font-family:Arial,Helvetica,sans-serif;font-size:${width === "58" ? 10 : 11}px;line-height:1.35}.r{padding:${width === "58" ? 3 : 4}mm}.c{text-align:center}.brand{font-size:${width === "58" ? 16 : 19}px;font-weight:900}.rule{border-top:1px dashed #000;margin:2.5mm 0}.row{display:flex;justify-content:space-between;gap:2mm;padding:1mm 0}.bold{font-weight:800}.total{font-size:1.15em;font-weight:900;border-top:1px solid #000;padding-top:1.5mm}.box{border:1px solid #000;padding:2mm;margin-top:2mm}.remark{font-size:1.2em;font-weight:900;letter-spacing:.08em}.small{font-size:.86em;overflow-wrap:anywhere}</style></head><body><main class="r">
    <div class="c brand">${esc(settings?.businessName || "HAVESTORY")}</div><div class="c bold">POS DAY-END SUMMARY</div><div class="c">${esc(result.date)}</div><div class="rule"></div>
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
    ${bankPrintHTML(defaultPOSBank(settings))}
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
