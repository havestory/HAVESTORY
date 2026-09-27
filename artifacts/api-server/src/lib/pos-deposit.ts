export function bankRemark(businessDate: string): string {
  if (!/^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/.test(businessDate)) throw new Error('Invalid business date');
  return businessDate.slice(2, 4) + businessDate.slice(5, 7) + businessDate.slice(8, 10);
}

export function depositDue(countedCash: unknown, nextDayFloat: unknown): number {
  const values = [countedCash, nextDayFloat];
  if (values.some(value => value === '' || value == null || !Number.isFinite(Number(value)) || Number(value) < 0 || Number(value) > 999999999999.99 || Math.abs(Number(value) * 100 - Math.round(Number(value) * 100)) > 1e-6))
    throw new Error('Enter valid cash and next-day float amounts');
  const counted = Number(countedCash);
  const retained = Number(nextDayFloat);
  if (retained > counted) throw new Error('Next-day float cannot exceed counted cash');
  return (Math.round(counted * 100) - Math.round(retained * 100)) / 100;
}
