export type BankEntry = {
  bankName: string;
  accountHolder: string;
  accountNumber: string;
  branch: string;
  swiftBic: string;
  website?: boolean;
  pos?: boolean;
  posDefault?: boolean;
};

/** Legacy accounts stay visible until the owner explicitly changes their channels. */
export function bankAccounts(settings: any): BankEntry[] {
  let rows: unknown;
  try {
    rows = JSON.parse(settings?.bankDetails || "[]");
  } catch {
    rows = [];
  }
  if (Array.isArray(rows) && rows.length) {
    return rows.filter(
      (b): b is BankEntry =>
        !!b &&
        typeof b === "object" &&
        typeof b.bankName === "string" &&
        typeof b.accountNumber === "string",
    );
  }
  if (!settings?.bankName && !settings?.bankAccountNumber) return [];
  return [
    {
      bankName: settings.bankName || "",
      accountHolder: settings.bankAccountHolder || "",
      accountNumber: settings.bankAccountNumber || "",
      branch: settings.bankBranch || "",
      swiftBic: settings.bankSwiftBic || "",
    },
  ];
}

export function visibleBanks(
  settings: any,
  channel: "website" | "pos",
): BankEntry[] {
  return bankAccounts(settings).filter((bank) => bank[channel] !== false);
}

export function defaultPOSBank(settings: any): BankEntry | undefined {
  const banks = visibleBanks(settings, "pos");
  return banks.find((bank) => bank.posDefault) || banks[0];
}

/** Validate writes rather than silently losing malformed or ambiguous settings. */
export function validateBankDetails(raw: unknown): string {
  const rows = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (!Array.isArray(rows) || rows.length > 50)
    throw new Error("Provide up to 50 bank accounts.");
  let defaults = 0;
  for (const bank of rows) {
    if (!bank || typeof bank !== "object")
      throw new Error("Invalid bank account.");
    for (const field of ["bankName", "accountNumber"]) {
      if (
        typeof bank[field] !== "string" ||
        !bank[field].trim() ||
        bank[field].length > 200
      )
        throw new Error(
          "Bank name and account number are required (maximum 200 characters).",
        );
    }
    for (const field of ["accountHolder", "branch", "swiftBic"]) {
      if (
        bank[field] !== undefined &&
        (typeof bank[field] !== "string" || bank[field].length > 200)
      )
        throw new Error("Bank details must be text of at most 200 characters.");
    }
    for (const field of ["website", "pos", "posDefault"]) {
      if (bank[field] !== undefined && typeof bank[field] !== "boolean")
        throw new Error("Bank visibility must be enabled or disabled.");
    }
    if (bank.posDefault) {
      if (bank.pos === false)
        throw new Error("The default POS bank must be enabled for POS.");
      if (++defaults > 1) throw new Error("Choose only one default POS bank.");
    }
  }
  return JSON.stringify(rows);
}
