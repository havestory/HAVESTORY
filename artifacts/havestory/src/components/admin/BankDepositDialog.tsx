import { useState } from "react";
import { defaultPOSBank, visibleBanks } from "@workspace/api-zod";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Printer, Landmark } from "lucide-react";
import { printDeposit } from "@/lib/bank-print";

type Props = {
  settings: any;
  width: "58" | "80";
  amount?: string;
  remark?: string;
  date: string;
  onClose: () => void;
};
export function BankDepositDialog({
  settings,
  width,
  amount = "",
  remark,
  date,
  onClose,
}: Props) {
  const banks = visibleBanks(settings, "pos");
  const initial = defaultPOSBank(settings);
  const [account, setAccount] = useState(
    Math.max(
      0,
      banks.findIndex(
        (b) =>
          b.accountNumber === initial?.accountNumber &&
          b.bankName === initial?.bankName,
      ),
    ),
  );
  const [deposit, setDeposit] = useState(amount);
  const [reference, setReference] = useState(
    remark || `P${date.slice(8, 10)}${date.slice(5, 7)}${date.slice(2, 4)}`,
  );
  const [error, setError] = useState("");
  const bank = banks[account];
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className="pos-dialog"
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          document
            .querySelector<HTMLButtonElement>("[data-deposit-trigger]")
            ?.focus();
        }}
      >
        <div className="pos-dialog-heading">
          <span className="pos-dialog-icon">
            <Landmark size={22} />
          </span>
          <div>
            <DialogTitle>Bank deposit receipt</DialogTitle>
            <DialogDescription>
              Print the account, amount and deposit reference.
            </DialogDescription>
          </div>
        </div>
        {!bank ? (
          <p className="pos-form-error">
            Enable a bank account for POS in Settings → Bank / Payment Details.
          </p>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              try {
                printDeposit(
                  bank,
                  Number(deposit),
                  reference,
                  date,
                  width,
                  settings?.businessName || "HAVESTORY",
                );
                setError("");
              } catch (err) {
                setError(
                  err instanceof Error ? err.message : "Could not print.",
                );
              }
            }}
          >
            <label className="pos-field">
              Bank account
              <select
                value={account}
                onChange={(e) => setAccount(Number(e.target.value))}
              >
                {banks.map((b, i) => (
                  <option key={i} value={i}>
                    {b.bankName} · {b.accountNumber}
                    {b.posDefault ? " · Default" : ""}
                  </option>
                ))}
              </select>
            </label>
            <div className="pos-bank-preview">
              <strong>{bank.bankName}</strong>
              <span>{bank.accountHolder}</span>
              <b>{bank.accountNumber}</b>
              {bank.branch && <span>Branch: {bank.branch}</span>}
              {bank.swiftBic && <span>SWIFT / BIC: {bank.swiftBic}</span>}
            </div>
            <div className="pos-fields">
              <label className="pos-field">
                Deposit amount (LKR)
                <input
                  required
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={deposit}
                  onChange={(e) => setDeposit(e.target.value)}
                  placeholder="0.00"
                />
              </label>
              <label className="pos-field">
                Remark / reference
                <input
                  required
                  maxLength={160}
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                />
              </label>
            </div>
            <p className="pos-helper">
              Printing this slip does not record a payment or close the POS day.
            </p>
            {error && (
              <p role="alert" className="pos-form-error">
                {error}
              </p>
            )}
            <div className="pos-dialog-actions">
              <button type="button" className="pos-secondary" onClick={onClose}>
                Cancel
              </button>
              <button className="pos-primary" type="submit">
                <Printer size={16} /> Print {width} mm receipt
              </button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
