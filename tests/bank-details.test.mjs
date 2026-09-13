import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  bankAccounts,
  visibleBanks,
  defaultPOSBank,
  validateBankDetails,
} from "../lib/api-zod/src/bank-details.ts";
const a = {
  bankName: "Website Bank",
  accountNumber: "001",
  website: true,
  pos: false,
};
const b = {
  bankName: "Counter Bank",
  accountNumber: "002",
  website: false,
  pos: true,
  posDefault: true,
};
const s = {
  bankDetails: JSON.stringify([a, b]),
  bankName: "Legacy",
  bankAccountNumber: "999",
};
test("website and POS channels stay independent after settings serialization", () => {
  const saved = { ...s, bankDetails: validateBankDetails(s.bankDetails) };
  assert.deepEqual(visibleBanks(saved, "website"), [a]);
  assert.deepEqual(visibleBanks(saved, "pos"), [b]);
  assert.deepEqual(defaultPOSBank(saved), b);
});
test("disabled accounts do not fall back to legacy fields", () => {
  const settings = {
    ...s,
    bankDetails: JSON.stringify([
      { ...a, website: false },
      { ...b, pos: false, posDefault: false },
    ]),
  };
  assert.equal(visibleBanks(settings, "website").length, 0);
  assert.equal(defaultPOSBank(settings), undefined);
});
test("old settings remain supported without migration", () => {
  const settings = {
    bankName: "Legacy Bank",
    bankAccountNumber: "000123",
    bankBranch: "Town",
  };
  assert.equal(defaultPOSBank(settings).accountNumber, "000123");
  assert.equal(visibleBanks(settings, "website")[0].branch, "Town");
  assert.equal(bankAccounts({ bankDetails: "broken" }).length, 0);
});
test("reject ambiguous defaults and malformed bank settings", () => {
  assert.throws(() =>
    validateBankDetails(
      JSON.stringify([b, { ...a, pos: true, posDefault: true }]),
    ),
  );
  assert.throws(() => validateBankDetails([{ ...b, pos: false }]));
  assert.throws(() =>
    validateBankDetails([{ bankName: "Bank", accountNumber: "" }]),
  );
  assert.throws(() => validateBankDetails([{ ...b, website: "false" }]));
  assert.throws(() => validateBankDetails("{}"));
});
