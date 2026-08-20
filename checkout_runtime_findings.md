# Checkout runtime findings

- `http://localhost:5173/checkout` renders as a dedicated full-page route inside the existing public layout; no checkout dialog is rendered.
- Empty-cart fallback is readable and provides a Return to collection action.
- With a seeded cart item, the page renders the Glass Gallery hero, details form, delivery choices, direct bank transfer payment card, order summary, coupon field, trust notes, and full-width secure order CTA.
- Default public settings exposed a Rs. 500 bank-transfer deposit notice and a Rs. 450 courier charge.
- Browser console cart seeding used the existing `havestory-shop-cart-v1` key and the existing ShopCartItem shape.
- The Vite production build and API server build completed successfully.

The storefront runtime also shows the cart drawer CTA as `CHECKOUT`, while the catalog remains available for custom inquiries. No legacy checkout dialog text or modal action appeared in the Store page extraction.

The local API server could not start for a live database smoke test because this sandbox session has no `DATABASE_URL`; this is an environment limitation, not a TypeScript or frontend build failure.
