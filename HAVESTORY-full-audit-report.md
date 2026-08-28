# HAVESTORY Full Application Audit Report

**Audit scope:** public website, mobile/responsive implementation, checkout and order lifecycle, API routes, authentication, settings exposure, deployment/build readiness, and dependency health.

**Audit method:** source review, route inventory, static risk scan, backend contract review, production-build validation, whitespace validation, dependency audit, and prior browser smoke-test evidence from the live storefront and checkout flow.

## Executive summary

The repository currently compiles and produces a Vercel-compatible build successfully. The customer order happy path was previously exercised in production with a synthetic order and returned success, so the order endpoint is not universally broken. The main functional risk is stale cart state: old product IDs or outdated option selections can survive in browser storage and reach checkout. The checkout worktree now includes a preflight guard and persistent error rendering for this case.

The audit also found two material areas that should be treated as follow-up work: **upload endpoints accept arbitrary multipart payloads without an application-level file type/size policy visible in the reviewed route code**, and **the API parser has no explicit JSON/urlencoded size limits**. These are operational/security hardening issues rather than proof of an immediately exploitable production incident, but they should be fixed before significant traffic growth.

Dependency auditing reported **2 critical, 7 high, and 2 moderate production dependency findings**, but the package-manager output did not include advisory package names in this environment. A lockfile-aware `pnpm audit --prod` review should be repeated in CI or a connected development environment and remediated before treating the dependency posture as clean.

## Severity-ranked findings

| ID | Severity | Area | Finding | Evidence / impact | Recommended action |
|---|---|---|---|---|---|
| SEC-01 | High | Upload security | Multiple Cloudinary-backed upload paths use Multer and do not show an explicit route-level MIME allowlist, byte limit, or image/document validation in the reviewed handlers. | Customer design files, payment proofs, and admin delivery/design files can consume storage or process unexpected content if upstream limits are absent. | Add strict `limits.fileSize`, file-count limits per route, MIME plus magic-byte validation, extension normalization, and reject executable/archive content. |
| SEC-02 | High | Request hardening | `express.json()` and `express.urlencoded()` are registered without explicit size limits. | Large bodies can increase memory/CPU pressure and amplify denial-of-service risk, especially alongside multipart endpoints. | Set conservative parser limits such as `100kb`/`1mb` as appropriate, and apply separate upload limits. |
| SEC-03 | High | Dependency health | Production dependency audit returned 2 critical, 7 high, and 2 moderate findings. | Vulnerable transitive dependencies may affect the deployed API/frontend even though the application builds. Package names were not emitted by this pnpm audit response. | Re-run `pnpm audit --prod --json` in CI, resolve direct advisories, update lockfile, and document unavoidable transitive exceptions. |
| DATA-01 | High | Checkout/cart | Browser-persisted cart entries can become stale after a product is unpublished or its configuration changes. | The backend correctly rejects inactive products, but the customer previously received an unhelpful failure path. This explains many “submit does not work” reports. | Keep the submit-time active-catalog preflight, remove invalid cart lines, and show the server message inline. Add a cart schema/version migration. |
| DATA-02 | Medium | Payment integrity | Order creation stores `paymentAmount` from the request after numeric bounding, but the reviewed route does not visibly enforce that a submitted non-admin payment amount is consistent with the selected payment method or total at creation time. | A customer can potentially submit an order with an arbitrary payment amount value even if later proof review has separate bounds. | Derive initial payment requirement server-side from trusted total and payment rules; treat client `paymentAmount` as informational only. |
| DATA-03 | Medium | Order fields | Several order fields are accepted with broad `any`/string handling (`notes`, `tags`, dates, `serviceTypeId`, design links, attachments). | Malformed shapes can persist and cause later rendering or admin workflow failures. | Add a shared Zod/Valibot schema for create/update order payloads and normalize every field before persistence. |
| AUTH-01 | Medium | Tracking access | Public tracking and customer uploads are protected by order ID plus normalized phone header, which is a reasonable barrier but is still a low-entropy shared secret. | Anyone who guesses both values can view order details or upload payment/design files. | Add short-lived signed tracking tokens or a one-time verification code, rate-limit failed attempts, and avoid revealing whether an order ID exists before verification. |
| AUTH-02 | Medium | Session operations | Admin cookies are HMAC-signed and `httpOnly`, `secure` in production, `sameSite=lax`, and expire after 24 hours. | Cookie design is sound, but review should ensure `SESSION_SECRET` is always set and rotated operationally. | Keep the production hard failure when missing; add secret rotation procedure and login rate limiting. |
| OPS-01 | Medium | CORS | When `FRONTEND_ORIGIN` is empty in production, the API allows every origin. | This may be intentional for a split deployment, but it broadens cross-origin request exposure and increases reliance on cookie/SameSite behavior. | Set `FRONTEND_ORIGIN` explicitly in production and fail deployment validation when it is absent. |
| OPS-02 | Medium | Observability | The build has no dedicated application test suite or lint script in the root package scripts. | TypeScript/build success does not verify checkout behavior, permissions, image export, or mobile visual regressions. | Add API integration tests for orders/auth and Playwright smoke tests for store → cart → checkout → tracking. |
| UX-01 | Medium | Mobile | The shared shell and responsive overrides have recently received a broad mobile pass, including a missing menu trigger, search alignment, drawer, touch sizing, and overflow controls. | These were identified as prior user-facing issues; broad CSS override layering remains a regression risk. | Keep a single mobile token block, remove obsolete overrides, and add screenshots at 320/375/414/768px in CI. |
| UX-02 | Low | Print/export | Shipping-label export now uses isolated capture and fixed geometry, which addresses the reported text drift. | Browser rendering and image capture can still differ for web fonts or long addresses. | Add automated long-name/long-address fixture snapshots and wait for font readiness before capture. |
| PERF-01 | Low | Frontend bundle | The Vercel build emits large-chunk warnings in addition to normal source-map warnings. | Large initial bundles can slow mobile startup, especially on lower-end devices. | Lazy-load admin-only modules, inspect the main chunk, and compress/defer non-critical imagery. |

## Verified strengths

| Area | Verified state |
|---|---|
| Build | Workspace typecheck passed. Vercel-compatible build passed. |
| Formatting | `git diff --check` passed during the final validation pass. |
| Public settings | Anonymous settings response explicitly removes Gmail credentials, payment gateway secrets, notification recipients, and finance recipient fields. |
| Admin authorization | Reviewed settings, products, services, portfolio, shipping-label settings, price-list, and staff routes use owner/admin/permission checks. |
| Order tracking guard | Customer tracking mutations use `requireOrderAccess`, which compares normalized phone digits against the stored order phone. |
| Coupon handling | Coupon usage is claimed transactionally and discount values are derived server-side rather than trusted from the client. |
| Trusted pricing | For non-admin orders, product records and configured options are used to resolve unit prices server-side. |
| Auth cookies | Production requires `SESSION_SECRET`; cookies are `httpOnly`, secure in production, SameSite Lax, and path scoped. |
| Live checkout evidence | A synthetic production checkout order was submitted successfully, confirming the valid happy path reaches the API and persists an order. |

## Route and workflow coverage

The frontend route inventory includes public Home, Store, Product Detail, Services, Gallery/Portfolio, Track Order, About, Contact, Checkout, custom project, legal, price list, and verification flows. Admin coverage includes dashboard, orders, custom projects, clients, CRM projects, invoices, products, services, portfolio, materials, reviews, messages, notices, settings, finance, reports, coupons, shipping labels, price lists, team, attendance, production usage, procurement, and verification reports.

The highest-value end-to-end workflows for automated regression coverage are:

1. Public settings hydration → header/logo → Store search → product option selection → add to cart.
2. Cart hydration after reload → stale product handling → checkout validation → order creation.
3. Bank transfer/COD/full-payment option rules → trusted server total → order confirmation.
4. Track order with valid and invalid ID/phone → friendly failure state → payment proof upload → customer confirmation.
5. Admin login → order review → payment approval → invoice synchronization → shipping-label generation → JPG download.
6. Admin settings update → public branding hydration → loader/header/footer logo replacement.

## Deployment and release readiness

The repository has repeatedly required rebasing because remote `main` received newer commits between local edits and push attempts. This created a real risk of silently retaining an older page implementation even when a Vercel deployment succeeded. Release discipline should therefore include checking the deployed commit SHA, not only checking that a deployment exists.

The current source/build validation is healthy, but the live deployment should be checked after each push using the exact production deployment commit. If the live site appears unchanged, verify the Vercel project root, production branch, deployment commit SHA, and browser cache before changing source again.

## Recommended priority order

**P0 before high traffic:** enforce upload size/type validation, set explicit body-parser limits, confirm `FRONTEND_ORIGIN`, and resolve or formally triage the 11 production dependency findings.

**P1 next:** add order payload schemas, server-side payment amount rules, tracking rate limits/tokens, and automated checkout/API tests.

**P2 quality:** consolidate mobile CSS overrides, add screenshot regression coverage, reduce admin bundle cost, and add label fixtures for long recipient data.

## Conclusion

The application is currently **buildable and deployable**, and the valid checkout path has been proven to work. It should not yet be classified as fully production-hardened because upload validation, parser limits, dependency advisories, and automated regression coverage remain open. The previous “nothing updated” perception was partly caused by remote rebase conflicts retaining older UI source, while the previous order-submit failure was most consistent with stale browser cart data rather than a universal API failure.
