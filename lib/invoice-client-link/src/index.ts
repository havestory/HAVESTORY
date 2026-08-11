import { clientsTable, invoicesTable } from "@workspace/db";
import type { Client, Invoice } from "@workspace/db";
import type { db as Db } from "@workspace/db";
import { eq, isNull, sql } from "drizzle-orm";

export type Contact = { name: string; phone: string; email: string };

export function normalizeName(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function normalizePhone(s: string | null | undefined): string {
  return (s ?? "").replace(/\D+/g, "");
}

export function normalizeEmail(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase();
}

export function extractContact(invoice: Invoice): Contact {
  let phone = "";
  let email = "";
  if (invoice.metadata) {
    try {
      const parsed = JSON.parse(invoice.metadata);
      const form = parsed?.form ?? {};
      phone = typeof form.phone === "string" ? form.phone : "";
      email = typeof form.email === "string" ? form.email : "";
    } catch {
      // metadata may be free-form / non-JSON on legacy rows; leave blank
    }
  }
  return {
    name: normalizeName(invoice.clientName),
    phone: normalizePhone(phone),
    email: normalizeEmail(email),
  };
}

export type ClientIndex = {
  byNamePhone: Map<string, Client[]>;
  byEmail: Map<string, Client[]>;
};

export function buildClientIndex(clients: Client[]): ClientIndex {
  const byNamePhone = new Map<string, Client[]>();
  const byEmail = new Map<string, Client[]>();
  for (const c of clients) {
    const name = normalizeName(c.name);
    const phone = normalizePhone(c.phone);
    if (name && phone) {
      const key = `${name}|${phone}`;
      const arr = byNamePhone.get(key) ?? [];
      arr.push(c);
      byNamePhone.set(key, arr);
    }
    const email = normalizeEmail(c.email);
    if (email) {
      const arr = byEmail.get(email) ?? [];
      arr.push(c);
      byEmail.set(email, arr);
    }
  }
  return { byNamePhone, byEmail };
}

export type MatchVia = "name+phone" | "email" | "name+phone+email" | "conflict";

export type MatchResult =
  | { kind: "matched"; client: Client; via: "name+phone" | "email" | "name+phone+email" }
  | { kind: "ambiguous"; via: "name+phone" | "email" | "conflict"; candidates: Client[] }
  | { kind: "no-contact" }
  | { kind: "no-match" };

function dedupeById(clients: Client[]): Client[] {
  const seen = new Set<number>();
  const out: Client[] = [];
  for (const c of clients) {
    if (seen.has(c.id)) continue;
    seen.add(c.id);
    out.push(c);
  }
  return out;
}

export function findClient(contact: Contact, index: ClientIndex): MatchResult {
  const hasNamePhone = Boolean(contact.name && contact.phone);
  const hasEmail = Boolean(contact.email);

  if (!hasNamePhone && !hasEmail) return { kind: "no-contact" };

  const namePhoneMatches = hasNamePhone
    ? dedupeById(index.byNamePhone.get(`${contact.name}|${contact.phone}`) ?? [])
    : [];
  const emailMatches = hasEmail ? dedupeById(index.byEmail.get(contact.email) ?? []) : [];

  const namePhoneUnique = namePhoneMatches.length === 1 ? namePhoneMatches[0] : null;
  const emailUnique = emailMatches.length === 1 ? emailMatches[0] : null;

  if (namePhoneUnique && emailUnique) {
    if (namePhoneUnique.id === emailUnique.id) {
      return { kind: "matched", client: namePhoneUnique, via: "name+phone+email" };
    }
    return {
      kind: "ambiguous",
      via: "conflict",
      candidates: [namePhoneUnique, emailUnique],
    };
  }

  if (namePhoneUnique) return { kind: "matched", client: namePhoneUnique, via: "name+phone" };
  if (emailUnique) return { kind: "matched", client: emailUnique, via: "email" };

  if (namePhoneMatches.length > 1) {
    return { kind: "ambiguous", via: "name+phone", candidates: namePhoneMatches };
  }
  if (emailMatches.length > 1) {
    return { kind: "ambiguous", via: "email", candidates: emailMatches };
  }
  return { kind: "no-match" };
}

export type BackfillRowEvent =
  | {
      kind: "matched";
      invoiceId: number;
      invoiceClientName: string | null;
      client: Client;
      via: "name+phone" | "email" | "name+phone+email";
    }
  | {
      kind: "ambiguous";
      invoiceId: number;
      invoiceClientName: string | null;
      via: "name+phone" | "email" | "conflict";
      candidates: Client[];
    }
  | { kind: "no-contact"; invoiceId: number; invoiceClientName: string | null }
  | { kind: "no-match"; invoiceId: number; invoiceClientName: string | null };

export type BackfillSummary = {
  totalProcessed: number;
  matched: number;
  ambiguous: number;
  noContact: number;
  noMatch: number;
  remaining: number;
  clientsLoaded: number;
};

export type BackfillResult = {
  summary: BackfillSummary;
  events: BackfillRowEvent[];
};

type DbInstance = typeof Db;

export type RunBackfillOptions = {
  /** Optional callback fired for each row as it's processed (useful for streaming logs). */
  onRow?: (event: BackfillRowEvent) => void;
};

/**
 * Re-link invoices whose `clientId` is NULL to existing client records by
 * matching on (name + phone) or email. Performs the database updates and
 * returns a structured summary plus per-row events.
 */
export async function runInvoiceClientBackfill(
  database: DbInstance,
  options: RunBackfillOptions = {},
): Promise<BackfillResult> {
  const { onRow } = options;

  const clients = await database.select().from(clientsTable);
  const index = buildClientIndex(clients);

  const unlinked = await database
    .select()
    .from(invoicesTable)
    .where(isNull(invoicesTable.clientId));

  let matched = 0;
  let ambiguous = 0;
  let noContact = 0;
  let noMatch = 0;
  const events: BackfillRowEvent[] = [];

  for (const invoice of unlinked) {
    const contact = extractContact(invoice);
    const result = findClient(contact, index);

    let event: BackfillRowEvent;
    switch (result.kind) {
      case "matched": {
        await database
          .update(invoicesTable)
          .set({ clientId: result.client.id })
          .where(eq(invoicesTable.id, invoice.id));
        matched++;
        event = {
          kind: "matched",
          invoiceId: invoice.id,
          invoiceClientName: invoice.clientName,
          client: result.client,
          via: result.via,
        };
        break;
      }
      case "ambiguous": {
        ambiguous++;
        event = {
          kind: "ambiguous",
          invoiceId: invoice.id,
          invoiceClientName: invoice.clientName,
          via: result.via,
          candidates: result.candidates,
        };
        break;
      }
      case "no-contact": {
        noContact++;
        event = {
          kind: "no-contact",
          invoiceId: invoice.id,
          invoiceClientName: invoice.clientName,
        };
        break;
      }
      case "no-match": {
        noMatch++;
        event = {
          kind: "no-match",
          invoiceId: invoice.id,
          invoiceClientName: invoice.clientName,
        };
        break;
      }
    }

    events.push(event);
    onRow?.(event);
  }

  const [{ count: remaining }] = await database
    .select({ count: sql<number>`count(*)::int` })
    .from(invoicesTable)
    .where(isNull(invoicesTable.clientId));

  return {
    summary: {
      totalProcessed: unlinked.length,
      matched,
      ambiguous,
      noContact,
      noMatch,
      remaining,
      clientsLoaded: clients.length,
    },
    events,
  };
}
