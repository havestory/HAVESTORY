import test from 'node:test';
import assert from 'node:assert/strict';
import { allocatePosPayment } from '../artifacts/api-server/src/lib/pos-settlement.ts';

const bills = [
  { id: 1, receipt_number: 'POS-1', total: '500.00', paid_amount: '0.00' },
  { id: 2, receipt_number: 'POS-2', total: '300.00', paid_amount: '50.00' },
];

test('full payment settles the oldest selected bills', () => {
  assert.deepEqual(allocatePosPayment(bills, 750), {
    allocations: [
      { saleId: 1, receiptNumber: 'POS-1', applied: 500, remaining: 0 },
      { saleId: 2, receiptNumber: 'POS-2', applied: 250, remaining: 0 },
    ], remaining: 0,
  });
});

test('partial payment carries forward only the remaining balance', () => {
  assert.deepEqual(allocatePosPayment(bills, 600.01), {
    allocations: [
      { saleId: 1, receiptNumber: 'POS-1', applied: 500, remaining: 0 },
      { saleId: 2, receiptNumber: 'POS-2', applied: 100.01, remaining: 149.99 },
    ], remaining: 149.99,
  });
});

test('rejects overpayment and invalid amounts', () => {
  assert.throws(() => allocatePosPayment(bills, 750.01));
  assert.throws(() => allocatePosPayment(bills, 0));
  assert.throws(() => allocatePosPayment(bills, 1.001));
});
