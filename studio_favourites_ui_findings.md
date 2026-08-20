# Studio favourites UI findings

The screenshot and local runtime confirm the home page uses the Glass Gallery palette, but the Studio favourites area currently has an unbalanced visual rhythm. The product card treatment uses a large fixed image, a white content block, and a footer that can read like a detached dark price strip. When only one featured product is available, the three-column grid leaves most of the section empty and makes the product feel visually stranded. The section header and card should be rebalanced for a single featured item, with the price/action row treated as a cohesive inline footer and a stronger editorial frame around the featured product.

The existing source is `artifacts/printbloom/src/pages/public/Home.tsx` and the home styles are in `artifacts/printbloom/src/index.css` under `.hsc-products-section`, `.hsc-product-grid`, and `.hsc-product-card`.

## Runtime verification

The local home page compiled and rendered successfully after the change. In the current sandbox dataset, no featured product records are available, so the page correctly renders the existing empty-state panel rather than the product card. The single-featured-product rules are scoped to `.hsc-product-grid-single` and `.hsc-product-card-featured`, so they will activate when the admin publishes one featured product and will not affect the empty state or multi-product grid.
