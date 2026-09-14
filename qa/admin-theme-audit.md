# Admin typography and colour audit

## Findings and source changes

| Finding | Resolution |
| --- | --- |
| Admin colours were defined in index.css, design-refresh.css, admin-stability.css and late cleanup styles. Light/dark state therefore depended on load order. | Removed 125 generic admin rules from the global/public files. Rewrote the existing admin-stability.css as the single palette/type source; removed admin-typography.css, admin-ui-cleanup.css and admin-icon-alignment.css. |
| Typography rules targeted a nonexistent data-admin-layout attribute; Inter was requested but only DM Sans was loaded, while global headings inherited a serif face. | Operational headings, forms and portal content now inherit the loaded DM Sans family. Existing monospace identifiers and print typography retain their purpose. |
| Forty admin page/component files used 3,045 palette utility occurrences, mixing gold, pink, blue and purple accents and fixed white backgrounds. | Replaced source utilities with named canvas/surface/ink/brand/status tokens. Consolidated duplicate tokens within class strings and removed decorative gradient classes. |
| Secondary text and alerts could be unreadable after switching themes. | Separate light/dark foreground, soft-surface and solid-action values. All 24 tested text/background pairs meet at least 4.5:1 contrast. |
| POS, Notices and Procurement independently hard-coded font and surface colours. | Edited each component stylesheet to consume the shared tokens; removed important flags from their screen styling. Retired the unused pos-panel-clean.css. |
| Dashboard chart colours and tooltip backgrounds did not consistently follow dark mode. | Updated data-series colours and tooltip text/surfaces at the chart source. Retained distinct series colours and labels. |
| Portalled dialogs inherit from the document rather than the admin DOM subtree. | The existing document theme attribute now provides palette variables, and shared portal roots inherit the same semantic UI aliases and font. |

## Palette and scope

Neutral canvas, white/dark surfaces, charcoal/light text and plum primary actions. Green indicates success, amber indicates attention, and red indicates destructive/error states. Status text and solid buttons use separate values so white button labels retain contrast in both modes.

No additional override stylesheet or utility-remapping layer was introduced. Existing component layout rules remain component-owned. The procurement paper subtree, print CSS, exported receipts, artwork colours, third-party brand marks and website theme swatches are intentionally distinct from the admin chrome.

## Verification

- Workspace typecheck and production build passed.
- All 14 tests passed, including light/dark contrast and a regression check against reintroducing important flags or legacy palette remapping in the canonical theme.
- All used admin colour utilities resolve to declared tokens.
- Public rules were retained while admin-specific rules were removed from the public stylesheets.
- The environment previously blocked the local browser preview with ERR_BLOCKED_BY_CLIENT. Rendered desktop/mobile interaction and production screenshots have not been verified. Existing build chunk-size/sourcemap warnings remain.
