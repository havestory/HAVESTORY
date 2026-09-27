import test from 'node:test';
import assert from 'node:assert/strict';
import { bankRemark, depositDue } from '../artifacts/api-server/src/lib/pos-deposit.ts';

test('cash retention yields the deposit without adding cash to the next drawer', () => {
  assert.equal(depositDue(20000, 5000), 15000);
  assert.equal(depositDue('100.01', '0.02'), 99.99);
  assert.equal(depositDue(5000, 5000), 0);
});

test('deposit calculation rejects negative, fractional cent and oversized floats', () => {
  assert.throws(() => depositDue(20000, 20001));
  assert.throws(() => depositDue('', 0));
  assert.throws(() => depositDue(20, 0.001));
  assert.throws(() => depositDue(-1, 0));
});

test('bank remark is YYMMDD', () => {
  assert.equal(bankRemark('2026-09-07'), '260907');
  assert.equal(bankRemark('2026-09-27'), '260927');
});
