import { db } from "@workspace/db";
import { runInvoiceClientBackfill } from "@workspace/invoice-client-link";

async function main() {
  console.log("Backfilling invoices.client_id from clients (name+phone or email)...\n");

  const { summary } = await runInvoiceClientBackfill(db, {
    onRow: (event) => {
      switch (event.kind) {
        case "matched":
          console.log(
            `[matched:${event.via}] invoice#${event.invoiceId} "${event.invoiceClientName}" → client #${event.client.id} ("${event.client.name}")`,
          );
          break;
        case "ambiguous": {
          const ids = event.candidates.map((c) => `#${c.id}`).join(", ");
          console.log(
            `[ambiguous:${event.via}] invoice#${event.invoiceId} "${event.invoiceClientName}" → ${event.candidates.length} candidates (${ids}) — left unchanged`,
          );
          break;
        }
        case "no-contact":
          console.log(
            `[skip:no-contact] invoice#${event.invoiceId} "${event.invoiceClientName}" — no phone/email in metadata`,
          );
          break;
        case "no-match":
          console.log(
            `[skip:no-match] invoice#${event.invoiceId} "${event.invoiceClientName}" — no client matches name+phone or email`,
          );
          break;
      }
    },
  });

  console.log(
    `\nLoaded ${summary.clientsLoaded} clients. Processed ${summary.totalProcessed} unlinked invoices.\n`,
  );
  console.log("=== Summary ===");
  console.log(`Matched (linked): ${summary.matched}`);
  console.log(`Ambiguous (skipped): ${summary.ambiguous}`);
  console.log(`Skipped — no contact info: ${summary.noContact}`);
  console.log(`Skipped — no client match: ${summary.noMatch}`);
  console.log(`Total processed: ${summary.totalProcessed}`);
  console.log(`\nRemaining invoices with clientId = NULL: ${summary.remaining}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Backfill failed:", err);
    process.exit(1);
  });
