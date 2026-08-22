# Item-photo feature browser verification

- Local storefront route `/store` loaded successfully with the existing HAVESTORY storefront layout.
- Local `/admin/products` route redirected to `/admin/login`, so the authenticated editor could not be opened in the sandbox browser without credentials.
- Source-level verification confirms item-specific photos are stored in `customConfig.optionGroups[].choices[].imageUrls`, not `form.galleryImages`.
- Public ProductDetail merges selected size/choice imageUrls into the active gallery and uses the first selected item photo as the display image.
