# POS interface and bank printing update

- Product configuration now uses a focus-managed, scrollable dialog with grouped option choices and a live price summary.
- Quantity icons use explicit button geometry. Admin icon styles match the actual admin root. Search fields flex within their padded container.
- POS history and day-end reconciliation are React components; unused DOM-injection scripts have been removed. History requests cancel on unmount/range changes, and refresh after sales or day close.
- Bank settings support independent Website/POS visibility and one POS print default. Legacy accounts remain compatible. Anonymous settings responses omit POS-only bank accounts and legacy fields are filtered too.
- Bank deposit slips include the selected account, amount and remark in 58/80 mm formats. Printing a deposit slip does not mark a payment as received. Normal POS and day-end receipts include the POS default bank.
- Sale print windows open before the network request to avoid popup blocking. A print failure after payment directs the cashier to reprint rather than charging again.

Validation: all workspace TypeScript checks passed, the production Vercel build passed, and all 11 bank-settings/POS-pricing tests passed. The build retains existing chunk-size and sourcemap warnings.

Limitations: the supplied screenshots were inspected, but this environment's browser blocked the local preview URL (`ERR_BLOCKED_BY_CLIENT`). Desktop/mobile rendered interactions and physical printer output could not be verified. No production payment, settings, or day-close data was modified during testing.
