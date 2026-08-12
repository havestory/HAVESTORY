import { Router } from "express";
import { db } from "@workspace/db";
import { productsTable, categoriesTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { getAdminAuth, requireAdmin, requireOwner } from "../lib/auth-cookie";
import { parseIdParam } from "../lib/parse-id";

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
    customConfig: productsTable.customConfig,
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

/** True when the Postgres error indicates a missing column (code 42703). */
function isMissingColumn(err: unknown): boolean {
  return (err as any)?.code === "42703";
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
      // invoice_name column not yet migrated — fall back without it
      products = await db
        .select(baseSelect())
        .from(productsTable)
        .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
        .where(where)
        .orderBy(productsTable.sortOrder);
    }

    res.json(products.map((p) => ({ ...p, invoiceName: p.invoiceName ?? null, galleryImages: parseGallery(p.galleryImages) })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

router.post("/", requireOwner, async (req, res) => {
  try {
    const { categoryId, name, invoiceName, description = "", price = "0", priceType = "per_item", imageUrl, galleryImages, artworkGuideUrl, artworkGuideName, featured = false, active = true, sortOrder = 0, customConfig } = req.body;

    let product: any;
    try {
      [product] = await db.insert(productsTable).values({
        categoryId,
        name,
        invoiceName: invoiceName || null,
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
      }).returning();
    } catch (err) {
      if (!isMissingColumn(err)) throw err;
      // Fallback: insert without invoiceName
      [product] = await db.insert(productsTable).values({
        categoryId,
        name,
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

    res.status(201).json({ ...product, invoiceName: product.invoiceName ?? null, category: null });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to create product" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const id = parseIdParam(req, res);
    if (id === null) return;

    let result: any;
    try {
      [result] = await db
        .select()
        .from(productsTable)
        .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
        .where(eq(productsTable.id, id));
    } catch (err) {
      if (!isMissingColumn(err)) throw err;
      [result] = await db
        .select({ products: { id: productsTable.id, categoryId: productsTable.categoryId, name: productsTable.name, description: productsTable.description, price: productsTable.price, priceType: productsTable.priceType, imageUrl: productsTable.imageUrl, galleryImages: productsTable.galleryImages, featured: productsTable.featured, active: productsTable.active, sortOrder: productsTable.sortOrder, customConfig: productsTable.customConfig, artworkGuideUrl: productsTable.artworkGuideUrl, artworkGuideName: productsTable.artworkGuideName, createdAt: productsTable.createdAt }, categories: { id: categoriesTable.id, name: categoriesTable.name, description: categoriesTable.description, imageUrl: categoriesTable.imageUrl, sortOrder: categoriesTable.sortOrder, createdAt: categoriesTable.createdAt } })
        .from(productsTable)
        .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
        .where(eq(productsTable.id, id));
    }

    if (!result) return res.status(404).json({ error: "Product not found" });
    const p = result.products;
    res.json({ ...p, invoiceName: (p as any).invoiceName ?? null, galleryImages: parseGallery(p.galleryImages), category: result.categories });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch product" });
  }
});

router.put("/:id", requireOwner, async (req, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid product id" });
    const { categoryId, name, invoiceName, description, price, priceType, imageUrl, galleryImages, artworkGuideUrl, artworkGuideName, featured, active, sortOrder, customConfig } = req.body;
    const updateData: any = {};
    if (categoryId !== undefined) updateData.categoryId = categoryId;
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (price !== undefined) updateData.price = price;
    if (priceType !== undefined) updateData.priceType = priceType;
    if (imageUrl !== undefined) updateData.imageUrl = imageUrl;
    if (galleryImages !== undefined) updateData.galleryImages = galleryImages ? JSON.stringify(galleryImages) : null;
    if (artworkGuideUrl !== undefined) updateData.artworkGuideUrl = artworkGuideUrl || null;
    if (artworkGuideName !== undefined) updateData.artworkGuideName = artworkGuideName || null;
    if (featured !== undefined) updateData.featured = featured;
    if (active !== undefined) updateData.active = active;
    if (sortOrder !== undefined) updateData.sortOrder = sortOrder;
    if (customConfig !== undefined) updateData.customConfig = customConfig;

    let product: any;
    try {
      if (invoiceName !== undefined) updateData.invoiceName = invoiceName || null;
      [product] = await db.update(productsTable).set(updateData).where(eq(productsTable.id, id)).returning();
    } catch (err) {
      if (!isMissingColumn(err)) throw err;
      // Retry without invoiceName
      delete updateData.invoiceName;
      [product] = await db.update(productsTable).set(updateData).where(eq(productsTable.id, id)).returning();
    }

    if (!product) return res.status(404).json({ error: "Product not found" });
    res.json({ ...product, invoiceName: (product as any).invoiceName ?? null, category: null });
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
