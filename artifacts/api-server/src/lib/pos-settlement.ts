export type OutstandingBill = { id: number; receipt_number: string; total: string | number; paid_amount: string | number };

export function allocatePosPayment(bills: OutstandingBill[], amount: number) {
  const cents = Math.round(amount * 100);
  if (!Number.isFinite(amount) || cents <= 0 || Math.abs(amount * 100 - cents) > 1e-6)
    throw new Error('Enter a valid payment amount');
  const due = bills.reduce((sum, bill) => sum + Math.round((Number(bill.total) - Number(bill.paid_amount)) * 100), 0);
  if (cents > due) throw new Error('Payment exceeds the selected balance');
  let left = cents;
  const allocations = bills.flatMap((bill) => {
    const balance = Math.round((Number(bill.total) - Number(bill.paid_amount)) * 100);
    if (balance <= 0) throw new Error('Bills changed; refresh outstanding bills');
    const applied = Math.min(balance, left);
    left -= applied;
    return applied ? [{ saleId: bill.id, receiptNumber: bill.receipt_number, applied: applied / 100, remaining: (balance - applied) / 100 }] : [];
  });
  return { allocations, remaining: (due - cents) / 100 };
}
