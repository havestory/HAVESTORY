import type { BankEntry } from "@workspace/api-zod";
export const escapePrint = (value: unknown) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (ch) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        ch
      ]!,
  );
export function bankPrintHTML(bank?: BankEntry) {
  if (!bank) return "";
  return `<div class="bank-details" style="margin-top:3mm;border-top:1px dashed #000;padding-top:2mm;overflow-wrap:anywhere"><b>${escapePrint(bank.bankName)}</b><br>${escapePrint(bank.accountHolder)}<br><b>A/C ${escapePrint(bank.accountNumber)}</b>${bank.branch ? `<br>Branch: ${escapePrint(bank.branch)}` : ""}${bank.swiftBic ? `<br>SWIFT / BIC: ${escapePrint(bank.swiftBic)}` : ""}</div>`;
}
export function printDeposit(
  bank: BankEntry,
  amount: number,
  remark: string,
  date: string,
  width: "58" | "80",
  name: string,
) {
  if (!Number.isFinite(amount) || amount <= 0 || !remark.trim())
    throw new Error("Enter a deposit amount greater than zero and a remark.");
  const win = window.open("", "_blank", "popup=yes,width=520,height=780");
  if (!win) throw new Error("Allow pop-ups to print the deposit receipt.");
  const mm = width === "58" ? 58 : 80;
  win.document.write(
    `<!doctype html><html><head><meta charset="utf-8"><title>Bank deposit ${escapePrint(remark)}</title><style>@page{size:${mm}mm auto;margin:0}*{box-sizing:border-box}body{width:${mm}mm;margin:0;padding:3mm;font:11px/1.5 Arial;color:#000;background:white;overflow-wrap:anywhere}h1{font-size:18px;text-align:center;margin:0}h2{text-align:center;font-size:13px}.amount{border:1px solid;padding:3mm;margin:3mm 0;font-size:17px;font-weight:bold}.remark{font-size:17px;font-weight:bold;letter-spacing:1px}p{margin:2mm 0}.note{font-size:10px;border-top:1px dashed;margin-top:4mm;padding-top:2mm}</style></head><body><h1>${escapePrint(name)}</h1><h2>BANK DEPOSIT SLIP</h2><p>Date: ${escapePrint(date)}</p>${bankPrintHTML(bank)}<div class="amount">LKR ${amount.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div><p>Deposit remark / reference</p><div class="remark">${escapePrint(remark)}</div><p class="note">Deposit instructions only. Keep the bank-issued confirmation as proof of payment.</p></body></html>`,
  );
  win.document.close();
  win.focus();
  window.setTimeout(() => {
    if (!win.closed) win.print();
  }, 300);
}
