# Live smoke findings — 2026-08-12

- Production URL: https://havestory.vercel.app/
- The deployed homepage loaded successfully from Vercel.
- The page rendered the Premium Editorial dark theme with a cinematic hero.
- The live page exposed the 10-image scroll story: indicators 01 through 10 and `01 / 10` were present.
- Header navigation rendered Home, Frames & Prints, Studio Services, Gallery, Track Order, About, Contact, Shop, and Custom Order.
- The public page did not show a blank screen or obvious image-loading failure during initial load.
- Vercel dashboard URL required authentication, so deployment verification was performed through the public hostname and GitHub commit status.

The live `/store` page loaded and the inquiry cart drawer opened successfully. However, production currently reports `00 / 00 objects` and `No frames found`, so the cart is empty and there is no product available to submit through the storefront order flow. This indicates a production catalog/data-state issue separate from the frontend order payload fix and prevents a complete customer order submission test until an active product exists.


## Follow-up production API check

The public endpoints respond successfully, but `GET https://havestory.vercel.app/api/products` and `GET https://havestory.vercel.app/api/categories` both return HTTP 200 with empty arrays. This confirms the storefront’s “No frames found” state is caused by an empty production catalog, not a frontend fetch crash. The admin route remains protected, so the code fix will add a login-free custom inquiry recovery path and harden admin order creation without requiring a browser session.


## Post-deployment verification — commit 221c94f

Vercel reported the deployment as successful. The public `/store` page now renders a styled “Start with your story” empty-catalog recovery card with both `START CUSTOM INQUIRY` and `EXPLORE CUSTOM ORDERS` actions, instead of leaving the customer with only an empty cart and a dead-end “No frames found” message.


## Final deployment — commit 700f057

Vercel reported commit `700f057` as successfully deployed. The final public `/store` page still loads normally with the Premium Editorial header and empty-catalog recovery behavior. The source now points the secondary recovery action to `/custom-project`, matching the existing public route.


## Final public route smoke test

The `EXPLORE CUSTOM ORDERS` action from the empty-catalog card navigates successfully to `https://havestory.vercel.app/custom-project`. The custom project form loads with required contact, project, size, quantity, budget, description, delivery, and upload fields, so customers have a functioning no-login fallback even while the product catalog is empty.


## Final primary inquiry smoke test

The final `/store` deployment’s `START CUSTOM INQUIRY` button opens the `Complete Your Inquiry` dialog, adds one `Custom Frame Consultation` item, shows `Quote on request`, and presents the required full name, phone, shipping address, notes, and `SUBMIT INQUIRY` controls. No login is required to reach this order path. No test submission was made, avoiding creation of a live business order with placeholder customer data.
