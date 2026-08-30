import { Router } from "express";
import { db } from "@workspace/db";
import { productsTable, categoriesTable } from "@workspace/db/schema";
import { eq, and, ne } from "drizzle-orm";
import { getAdminAuth, requireAdmin, requireOwner } from "../lib/auth-cookie";
import { syncNormalizedProductCatalog } from "../lib/product-catalog";

const router = Router();

function parseGallery(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseKeywords(raw: unknown): string[] {
  const values = Array.isArray(raw)
    ? raw
    : typeof raw === "string"
      ? raw.split(/[,\n]/)
      : [];
  return [...new Set(values
    .map(value => String(value ?? "").trim())
    .filter(Boolean)
    .slice(0, 30))];
}

function parseStoredKeywords(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    return parseKeywords(JSON.parse(raw));
  } catch {
    return parseKeywords(raw);
  }
}

export function slugifyProductName(value: string): string {
  return String(value || "product")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 85) || "product";
}

async function uniqueProductSlug(name: string, excludeId?: number): Promise<string> {
  const base = slugifyProductName(name);
  let candidate = base;
  let suffix = 2;
  while (true) {
    const conditions = [eq(productsTable.slug, candidate)];
    if (excludeId !== undefined) conditions.push(ne(productsTable.id, excludeId));
    const [existing] = await db.select({ id: productsTable.id }).from(productsTable).where(and(...conditions));
    if (!existing) return candidate;
    candidate = `${base}-${suffix++}`;
  }
}

function serializeProduct(product: any, category: any = null) {
  return {
    ...product,
    slug: product.slug || slugifyProductName(product.name),
    keywords: parseStoredKeywords(product.keywords),
    invoiceName: product.invoiceName ?? null,
    galleryImages: parseGallery(product.galleryImages),
    category: category ?? product.category ?? null,
  };
}

function normalizeCustomConfig(raw: unknown): string | null | undefined {
  if (raw === undefined || raw === null) return raw as null | undefined;
  if (typeof raw !== "string") return undefined;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return raw;
    const config = parsed as any;
    if (Array.isArray(config.optionGroups)) {
      config.optionGroups = config.optionGroups.map((group: any) => ({
        ...group,
        choices: Array.isArray(group?.choices) ? group.choices.map((choice: any) => ({
          ...choice,
          price: choice?.price === "" || choice?.price === null || choice?.price === undefined ? "0" : String(choice.price),
          sizePrices: Array.isArray(choice?.sizePrices) ? choice.sizePrices.map((override: any) => ({
            ...override,
            price: override?.price === "" || override?.price === null || override?.price === undefined ? "0" : String(override.price),
          })) : choice?.sizePrices,
        })) : [],
      }));
    }
    return JSON.stringify(config);
  } catch {
    return raw;
  }
}

const PRODUCT_FORMATS = new Set(["ready_made", "frame_print", "print_service", "finishing"]);

function parseProductFormat(raw: unknown): string | undefined {
  let value: unknown = raw;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      value = parsed && typeof parsed === "object" ? (parsed as any).productFormat : raw;
    } catch {
      value = raw;
    }
  } else if (raw && typeof raw === "object") {
    value = (raw as any).productFormat;
  }
  return typeof value === "string" && PRODUCT_FORMATS.has(value) ? value : undefined;
}

/** Build the base select (without invoiceName) so we can fall back if column is missing */
function baseSelect() {
  return {
    id: productsTable.id,
    categoryId: productsTable.categoryId,
    name: productsTable.name,
    description: productsTable.description,
    price: productsTable.price,
    priceType: productsTable.priceType,
    imageUrl: productsTable.imageUrl,
    galleryImages: productsTable.galleryImages,
    featured: productsTable.featured,
    active: productsTable.active,
    sortOrder: productsTable.sortOrder,
    productFormat: productsTable.productFormat,
    customConfig: productsTable.customConfig,
    slug: productsTable.slug,
    keywords: productsTable.keywords,
    artworkGuideUrl: productsTable.artworkGuideUrl,
    artworkGuideName: productsTable.artworkGuideName,
    createdAt: productsTable.createdAt,
    category: {
      id: categoriesTable.id,
      name: categoriesTable.name,
      description: categoriesTable.description,
      imageUrl: categoriesTable.imageUrl,
      sortOrder: categoriesTable.sortOrder,
      createdAt: categoriesTable.createdAt,
    },
  };
}

function legacyBaseSelect() {
  const { productFormat: _productFormat, slug: _slug, keywords: _keywords, artworkGuideUrl: _artworkGuideUrl, artworkGuideName: _artworkGuideName, ...select } = baseSelect();
  return select;
}

function legacyProductSelect() {
  const { category: _category, ...select } = legacyBaseSelect();
  return select;
}

/** True when the Postgres driver reports a missing column, regardless of error shape. */
function isMissingColumn(err: unknown): boolean {
  const error = err as any;
  return error?.code === "42703" || /column [^\n]+ does not exist/i.test(String(error?.message ?? err ?? ""));
}

router.get("/", async (req, res) => {
  try {
    const { categoryId, featured } = req.query;
    const conditions: any[] = [];
    // Public visitors should only see products that are explicitly published.
    // Authenticated admins still receive inactive products so they can edit or
    // reactivate them from the catalog manager.
    if (!getAdminAuth(req)) conditions.push(eq(productsTable.active, true));
    if (categoryId) conditions.push(eq(productsTable.categoryId, parseInt(categoryId as string)));
    if (featured !== undefined) conditions.push(eq(productsTable.featured, featured === "true"));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    let products: any[];
    try {
      products = await db
        .select({ ...baseSelect(), invoiceName: productsTable.invoiceName })
        .from(productsTable)
        .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
        .where(where)
        .orderBy(productsTable.sortOrder);
    } catch (err) {
      if (!isMissingColumn(err)) throw err;
      // invoice_name may not be migrated yet; keep product_format when it exists.
      try {
        products = await db
          .select(baseSelect())
          .from(productsTable)
          .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
          .where(where)
          .orderBy(productsTable.sortOrder);
      } catch (legacyErr) {
        if (!isMissingColumn(legacyErr)) throw legacyErr;
        // Very old databases may predate both optional columns.
        products = await db
          .select(legacyBaseSelect())
          .from(productsTable)
          .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
          .where(where)
          .orderBy(productsTable.sortOrder);
      }
    }

    res.setHeader("Cache-Control", getAdminAuth(req) ? "private, no-store" : "public, s-maxage=60, stale-while-revalidate=300");
    res.json(products.map((p) => serializeProduct(p, p.category)));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

router.post("/", requireOwner, async (req, res) => {
  try {
    const { categoryId, name, invoiceName, description = "", price = "0", priceType = "per_item", productFormat: requestedProductFormat, imageUrl, galleryImages, artworkGuideUrl, artworkGuideName, featured = false, active = true, sortOrder = 0, customConfig } = req.body;
    const keywords = parseKeywords(req.body.keywords);
    const normalizedCustomConfig = normalizeCustomConfig(customConfig);
    const slug = await uniqueProductSlug(String(name || "product"));
    const productFormat = parseProductFormat(requestedProductFormat) || parseProductFormat(normalizedCustomConfig) || "ready_made";

    let product: any;
    try {
      [product] = await db.insert(productsTable).values({
        categoryId,
        name,
        slug,
        keywords: JSON.stringify(keywords),
        invoiceName: invoiceName || null,
        description,
        price,
        priceType,
        productFormat,
        imageUrl,
        galleryImages: galleryImages ? JSON.stringify(galleryImages) : null,
        artworkGuideUrl: artworkGuideUrl || null,
        artworkGuideName: artworkGuideName || null,
        featured,
        active,
        sortOrder,
        customConfig: normalizedCustomConfig,
      }).returning();
    } catch (err) {
      if (!isMissingColumn(err)) throw err;
      // Fallback for databases that still lack invoice_name.
      try {
        [product] = await db.insert(productsTable).values({
          categoryId,
          name,
          slug,
          keywords: JSON.stringify(keywords),
          description,
          price,
          priceType,
          productFormat,
          imageUrl,
          galleryImages: galleryImages ? JSON.stringify(galleryImages) : null,
          artworkGuideUrl: artworkGuideUrl || null,
          artworkGuideName: artworkGuideName || null,
          featured,
          active,
          sortOrder,
          customConfig,
        } as any).returning();
      } catch (legacyErr) {
        if (!isMissingColumn(legacyErr)) throw legacyErr;
        // Older databases may also predate product_format.
        [product] = await db.insert(productsTable).values({
          categoryId,
          name,
          slug,
          keywords: JSON.stringify(keywords),
          description,
          price,
          priceType,
          imageUrl,
          galleryImages: galleryImages ? JSON.stringify(galleryImages) : null,
          artworkGuideUrl: artworkGuideUrl || null,
          artworkGuideName: artworkGuideName || null,
          featured,
          active,
          sortOrder,
          customConfig,
        } as any).returning();
      }
    }

    await syncNormalizedProductCatalog(product.id, normalizedCustomConfig, imageUrl, Array.isArray(galleryImages) ? galleryImages : []);
    res.status(201).json({ ...product, invoiceName: product.invoiceName ?? null, category: null });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to create product" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const identifier = String(req.params.id || "").trim();
    if (!identifier) return res.status(400).json({ error: "Invalid product identifier" });
    const numericId = /^\d+$/.test(identifier) ? Number(identifier) : null;
    const lookup = numericId !== null ? eq(productsTable.id, numericId) : eq(productsTable.slug, identifier);

    let result: any;
    try {
      [result] = await db
        .select()
        .from(productsTable)
        .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
        .where(lookup);
    } catch (err) {
      if (!isMissingColumn(err) || numericId === null) throw err;
      try {
        [result] = await db
          .select({ products: { id: productsTable.id, categoryId: productsTable.categoryId, name: productsTable.name, description: productsTable.description, price: productsTable.price, priceType: productsTable.priceType, imageUrl: productsTable.imageUrl, galleryImages: productsTable.galleryImages, featured: productsTable.featured, active: productsTable.active, sortOrder: productsTable.sortOrder, customConfig: productsTable.customConfig, artworkGuideUrl: productsTable.artworkGuideUrl, artworkGuideName: productsTable.artworkGuideName, createdAt: productsTable.createdAt }, categories: { id: categoriesTable.id, name: categoriesTable.name, description: categoriesTable.description, imageUrl: categoriesTable.imageUrl, sortOrder: categoriesTable.sortOrder, createdAt: categoriesTable.createdAt } })
          .from(productsTable)
          .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
          .where(eq(productsTable.id, numericId));
      } catch (legacyArtworkErr) {
        if (!isMissingColumn(legacyArtworkErr)) throw legacyArtworkErr;
        [result] = await db
          .select({ products: legacyProductSelect(), categories: { id: categoriesTable.id, name: categoriesTable.name, description: categoriesTable.description, imageUrl: categoriesTable.imageUrl, sortOrder: categoriesTable.sortOrder, createdAt: categoriesTable.createdAt } })
          .from(productsTable)
          .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
          .where(eq(productsTable.id, numericId));
      }
    }

    if (!result) return res.status(404).json({ error: "Product not found" });
    const p = result.products;
    if (!p.active && !getAdminAuth(req)) return res.status(404).json({ error: "Product not found" });
    res.json(serializeProduct({ ...p, productFormat: (p as any).productFormat ?? parseProductFormat(p.customConfig) ?? "ready_made" }, result.categories));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch product" });
  }
});

router.put("/:id", requireOwner, async (req, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid product id" });
    const { categoryId, name, invoiceName, description, price, priceType, productFormat: requestedProductFormat, imageUrl, galleryImages, artworkGuideUrl, artworkGuideName, featured, active, sortOrder, customConfig } = req.body;
    const normalizedCustomConfig = normalizeCustomConfig(customConfig);
    const keywords = req.body.keywords === undefined ? undefined : parseKeywords(req.body.keywords);
    const updateData: any = {};
    if (categoryId !== undefined) updateData.categoryId = categoryId;
    if (name !== undefined) {
      updateData.name = name;
      updateData.slug = await uniqueProductSlug(String(name || "product"), id);
    }
    if (keywords !== undefined) updateData.keywords = JSON.stringify(keywords);
    if (description !== undefined) updateData.description = description;
    if (price !== undefined) updateData.price = price;
    if (priceType !== undefined) updateData.priceType = priceType;
    if (requestedProductFormat !== undefined) updateData.productFormat = parseProductFormat(requestedProductFormat) || "ready_made";
    else if (customConfig !== undefined) {
      const derivedFormat = parseProductFormat(normalizedCustomConfig);
      if (derivedFormat) updateData.productFormat = derivedFormat;
    }
    if (imageUrl !== undefined) updateData.imageUrl = imageUrl;
    if (galleryImages !== undefined) updateData.galleryImages = galleryImages ? JSON.stringify(galleryImages) : null;
    if (artworkGuideUrl !== undefined) updateData.artworkGuideUrl = artworkGuideUrl || null;
    if (artworkGuideName !== undefined) updateData.artworkGuideName = artworkGuideName || null;
    if (featured !== undefined) updateData.featured = featured;
    if (active !== undefined) updateData.active = active;
    if (sortOrder !== undefined) updateData.sortOrder = sortOrder;
    if (customConfig !== undefined) updateData.customConfig = normalizedCustomConfig;

    let product: any;
    try {
      if (invoiceName !== undefined) updateData.invoiceName = invoiceName || null;
      [product] = await db.update(productsTable).set(updateData).where(eq(productsTable.id, id)).returning();
    } catch (err) {
      if (!isMissingColumn(err)) throw err;
      // Retry without invoiceName, then without product_format for very old schemas.
      delete updateData.invoiceName;
      try {
        [product] = await db.update(productsTable).set(updateData).where(eq(productsTable.id, id)).returning();
      } catch (legacyErr) {
        if (!isMissingColumn(legacyErr)) throw legacyErr;
        delete updateData.productFormat;
        [product] = await db.update(productsTable).set(updateData).where(eq(productsTable.id, id)).returning();
      }
    }

    if (!product) return res.status(404).json({ error: "Product not found" });
    await syncNormalizedProductCatalog(product.id, product.customConfig, product.imageUrl, parseGallery(product.galleryImages));
    res.json(serializeProduct(product));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to update product" });
  }
});

router.delete("/:id", requireOwner, async (req, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid product id" });
    await db.delete(productsTable).where(eq(productsTable.id, id));
    res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to delete product" });
  }
});

export default router;
