import { pool } from "@workspace/db";
import { syncAllNormalizedProductCatalog } from "./product-catalog";

/**
 * Idempotent schema migrations that add any columns that might be missing
 * in an older production database. Safe to run on every server start.
 * Uses ALTER TABLE … ADD COLUMN IF NOT EXISTS so duplicate runs are harmless.
 */
export async function runStartupMigrations(
  log: (msg: string) => void = console.log,
): Promise<void> {
  const client = await pool.connect();
  try {
    // Isolated from the rest of startup DDL so an unrelated legacy index
    // cannot roll back the services compatibility repair.
    await client.query(`
      -- Keep the services module compatible with databases created before
      -- service categories and the extended service fields were introduced.
      CREATE TABLE IF NOT EXISTS service_categories (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS services (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        price TEXT,
        price_type TEXT NOT NULL DEFAULT 'custom_quote',
        package_details TEXT,
        highlights TEXT NOT NULL DEFAULT '[]',
        image_url TEXT,
        featured BOOLEAN NOT NULL DEFAULT FALSE,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        sort_order INTEGER NOT NULL DEFAULT 0,
        category_id INTEGER,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      ALTER TABLE services
        ADD COLUMN IF NOT EXISTS package_details TEXT,
        ADD COLUMN IF NOT EXISTS highlights TEXT NOT NULL DEFAULT '[]',
        ADD COLUMN IF NOT EXISTS image_url TEXT,
        ADD COLUMN IF NOT EXISTS featured BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE,
        ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS category_id INTEGER;
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS admin_staff (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        last_login_at TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS admin_activity_log (
        id BIGSERIAL PRIMARY KEY,
        actor_type TEXT NOT NULL,
        actor_id INTEGER,
        actor_username TEXT NOT NULL,
        action TEXT NOT NULL,
        method TEXT NOT NULL,
        path TEXT NOT NULL,
        status_code INTEGER,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS admin_activity_created_idx ON admin_activity_log(created_at DESC);
      CREATE INDEX IF NOT EXISTS admin_activity_actor_idx ON admin_activity_log(actor_id, created_at DESC);

      -- O(1), concurrency-safe order numbering. Seed from legacy IDs once per startup.
      CREATE SEQUENCE IF NOT EXISTS order_number_seq MINVALUE 1;
      SELECT setval(
        'order_number_seq',
        GREATEST(1, seed.max_value),
        seed.max_value > 0
      )
      FROM (
        SELECT GREATEST(
          COUNT(*)::bigint,
          COALESCE(MAX(((regexp_match(order_id, '(?:[A-Z]{2}-)?[A-Z]+-([0-9]{4})(?:-[A-Z0-9]+)?$'))[1])::bigint), 0)
        ) AS max_value
        FROM orders
      ) seed;

      -- Reports performance indexes (allow range scans without DATE() cast overhead)
      CREATE INDEX IF NOT EXISTS idx_orders_created_at       ON orders  (created_at DESC) WHERE deleted_at IS NULL;
      CREATE INDEX IF NOT EXISTS idx_orders_status_created   ON orders  (status, created_at DESC) WHERE deleted_at IS NULL;
      CREATE INDEX IF NOT EXISTS idx_orders_customer_phone   ON orders  (customer_phone) WHERE deleted_at IS NULL;
      CREATE INDEX IF NOT EXISTS idx_invoices_created_at     ON invoices(created_at DESC) WHERE deleted_at IS NULL;
      CREATE INDEX IF NOT EXISTS idx_invoices_status_created ON invoices(status, created_at DESC) WHERE deleted_at IS NULL;
      CREATE INDEX IF NOT EXISTS idx_invoices_client_created ON invoices(client_id, created_at DESC) WHERE deleted_at IS NULL;
      CREATE INDEX IF NOT EXISTS idx_invoices_legacy_name ON invoices(LOWER(BTRIM(client_name))) WHERE deleted_at IS NULL AND client_id IS NULL;
      CREATE INDEX IF NOT EXISTS idx_crm_projects_client_created ON crm_projects(client_id, created_at DESC) WHERE deleted_at IS NULL;
      CREATE INDEX IF NOT EXISTS idx_crm_projects_legacy_name ON crm_projects(LOWER(BTRIM(client_name))) WHERE deleted_at IS NULL AND client_id IS NULL;
      CREATE INDEX IF NOT EXISTS idx_clients_created_at      ON clients (created_at DESC) WHERE deleted_at IS NULL;
      CREATE INDEX IF NOT EXISTS idx_inv_material_usage_item ON invoice_material_usage(inventory_item_id, created_at);
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS coupons (
        id SERIAL PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        type TEXT NOT NULL DEFAULT 'percentage',
        value REAL NOT NULL,
        min_order REAL,
        max_uses INTEGER,
        used_count INTEGER NOT NULL DEFAULT 0,
        is_active INTEGER NOT NULL DEFAULT 1,
        expires_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`
      ALTER TABLE settings
        ADD COLUMN IF NOT EXISTS tiktok_url TEXT,
        ADD COLUMN IF NOT EXISTS owner_name TEXT,
        ADD COLUMN IF NOT EXISTS logo_url TEXT,
        ADD COLUMN IF NOT EXISTS bank_details TEXT NOT NULL DEFAULT '[]',
        ADD COLUMN IF NOT EXISTS overdue_days INTEGER NOT NULL DEFAULT 30,
        ADD COLUMN IF NOT EXISTS courier_charge TEXT NOT NULL DEFAULT '450',
        ADD COLUMN IF NOT EXISTS sl_post_charge TEXT NOT NULL DEFAULT '250',
        ADD COLUMN IF NOT EXISTS invoice_standard_rate TEXT NOT NULL DEFAULT '350',
        ADD COLUMN IF NOT EXISTS invoice_express_rate TEXT NOT NULL DEFAULT '530',
        ADD COLUMN IF NOT EXISTS invoice_weight_first_kg TEXT NOT NULL DEFAULT '450',
        ADD COLUMN IF NOT EXISTS invoice_weight_add_kg TEXT NOT NULL DEFAULT '200',
        ADD COLUMN IF NOT EXISTS tagline_enabled INTEGER NOT NULL DEFAULT 1,
        ADD COLUMN IF NOT EXISTS show_name_with_logo INTEGER NOT NULL DEFAULT 1,
        ADD COLUMN IF NOT EXISTS favicon_url TEXT,
        ADD COLUMN IF NOT EXISTS whatsapp_order_template TEXT NOT NULL DEFAULT 'Hi {customerName}! Thank you for your order.',
        ADD COLUMN IF NOT EXISTS hero_slide_image1 TEXT,
        ADD COLUMN IF NOT EXISTS hero_slide_image2 TEXT,
        ADD COLUMN IF NOT EXISTS hero_slide_image3 TEXT,
        ADD COLUMN IF NOT EXISTS hero_slide_image4 TEXT,
        ADD COLUMN IF NOT EXISTS hero_slide_image5 TEXT,
        ADD COLUMN IF NOT EXISTS hero_slide_image6 TEXT,
        ADD COLUMN IF NOT EXISTS hero_slide_image7 TEXT,
        ADD COLUMN IF NOT EXISTS hero_slide_image8 TEXT,
        ADD COLUMN IF NOT EXISTS hero_slide_image9 TEXT,
        ADD COLUMN IF NOT EXISTS hero_slide_image10 TEXT,
        ADD COLUMN IF NOT EXISTS hero_slide_enabled TEXT NOT NULL DEFAULT '[true,true,true,true,true,true,true,true,true,true]',
        ADD COLUMN IF NOT EXISTS home_feature_cards TEXT NOT NULL DEFAULT '[]',
        ADD COLUMN IF NOT EXISTS payment_qr_url TEXT,
        ADD COLUMN IF NOT EXISTS payment_button_url TEXT,
        ADD COLUMN IF NOT EXISTS payment_button_label TEXT,
        ADD COLUMN IF NOT EXISTS site_closed_enabled INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS site_closed_message TEXT NOT NULL DEFAULT 'We are currently closed for maintenance. We will be back soon!',
        ADD COLUMN IF NOT EXISTS ipay_enabled INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS ipay_sandbox INTEGER NOT NULL DEFAULT 1,
        ADD COLUMN IF NOT EXISTS ipay_token TEXT,
        ADD COLUMN IF NOT EXISTS ipay_secret TEXT,
        ADD COLUMN IF NOT EXISTS pay_button_visible INTEGER NOT NULL DEFAULT 1,
        ADD COLUMN IF NOT EXISTS google_pay_enabled INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS google_pay_number TEXT,
        ADD COLUMN IF NOT EXISTS google_pay_qr_url TEXT,
        ADD COLUMN IF NOT EXISTS google_pay_instructions TEXT,
        ADD COLUMN IF NOT EXISTS checkout_courier_enabled INTEGER NOT NULL DEFAULT 1,
        ADD COLUMN IF NOT EXISTS checkout_courier_label TEXT NOT NULL DEFAULT 'Studio courier',
        ADD COLUMN IF NOT EXISTS checkout_courier_description TEXT NOT NULL DEFAULT 'Carefully packed and delivered to your door.',
        ADD COLUMN IF NOT EXISTS checkout_sl_post_enabled INTEGER NOT NULL DEFAULT 1,
        ADD COLUMN IF NOT EXISTS checkout_sl_post_label TEXT NOT NULL DEFAULT 'Sri Lanka Post',
        ADD COLUMN IF NOT EXISTS checkout_sl_post_description TEXT NOT NULL DEFAULT 'A considered island-wide delivery route.',
        ADD COLUMN IF NOT EXISTS checkout_pickup_enabled INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS checkout_pickup_label TEXT NOT NULL DEFAULT 'Studio pickup',
        ADD COLUMN IF NOT EXISTS checkout_pickup_description TEXT NOT NULL DEFAULT 'Collect your order from the HAVESTORY studio.',
        ADD COLUMN IF NOT EXISTS checkout_pickup_address TEXT NOT NULL DEFAULT 'Contact us for pickup details.',
        ADD COLUMN IF NOT EXISTS checkout_bank_transfer_enabled INTEGER NOT NULL DEFAULT 1,
        ADD COLUMN IF NOT EXISTS checkout_deposit_amount INTEGER NOT NULL DEFAULT 500,
        ADD COLUMN IF NOT EXISTS checkout_deposit_message TEXT NOT NULL DEFAULT 'A Rs. 500 deposit is required to confirm this order. Upload your payment proof after paying.',
        ADD COLUMN IF NOT EXISTS checkout_full_payment_enabled INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS checkout_full_payment_offer TEXT NOT NULL DEFAULT 'Pay the full amount upfront and receive a special offer.',
        ADD COLUMN IF NOT EXISTS checkout_full_payment_discount INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS checkout_cod_enabled INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS checkout_cod_message TEXT NOT NULL DEFAULT 'Cash on delivery is currently unavailable.',
        ADD COLUMN IF NOT EXISTS order_email_notifications_enabled INTEGER NOT NULL DEFAULT 1,
        ADD COLUMN IF NOT EXISTS order_email_recipients TEXT NOT NULL DEFAULT '',
        ADD COLUMN IF NOT EXISTS gmail_user TEXT,
        ADD COLUMN IF NOT EXISTS gmail_app_password TEXT,
        ADD COLUMN IF NOT EXISTS finance_report_email_enabled INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS finance_report_email_recipient TEXT;
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS project_service_types (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`
      ALTER TABLE orders
        ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'bank_transfer',
        ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'pending',
        ADD COLUMN IF NOT EXISTS payment_amount INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS payment_type TEXT NOT NULL DEFAULT 'advance',
        ADD COLUMN IF NOT EXISTS payment_submitted_amount INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS payment_proof_status TEXT NOT NULL DEFAULT 'not_uploaded',
        ADD COLUMN IF NOT EXISTS payment_proof_uploaded_at TIMESTAMP,
        ADD COLUMN IF NOT EXISTS payment_proof_expires_at TIMESTAMP,
        ADD COLUMN IF NOT EXISTS payment_approved_at TIMESTAMP,
        ADD COLUMN IF NOT EXISTS payment_rejection_reason TEXT,
        ADD COLUMN IF NOT EXISTS customer_payment_confirmed_at TIMESTAMP,
        ADD COLUMN IF NOT EXISTS service_type_id INTEGER,
        ADD COLUMN IF NOT EXISTS due_date TEXT,
        ADD COLUMN IF NOT EXISTS start_date TEXT,
        ADD COLUMN IF NOT EXISTS priority TEXT,
        ADD COLUMN IF NOT EXISTS discount_amount INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS advance_paid INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS tags TEXT NOT NULL DEFAULT '[]';
    `);
    await client.query(`
      ALTER TABLE crm_projects
        ADD COLUMN IF NOT EXISTS service_type_id INTEGER;
    `);
    await client.query(`
      ALTER TABLE clients
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT NOW();
    `);
    await client.query(`
      ALTER TABLE invoices
        ADD COLUMN IF NOT EXISTS client_id INTEGER,
        ADD COLUMN IF NOT EXISTS client_phone TEXT,
        ADD COLUMN IF NOT EXISTS client_email TEXT;
    `);
    await client.query(`
      ALTER TABLE orders
        ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
    `);
    await client.query(`
      ALTER TABLE invoices
        ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
    `);
    await client.query(`
      ALTER TABLE clients
        ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
    `);
    await client.query(`
      ALTER TABLE crm_projects
        ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
    `);
    await client.query(`
      ALTER TABLE products
        ADD COLUMN IF NOT EXISTS invoice_name TEXT,
        ADD COLUMN IF NOT EXISTS product_format TEXT NOT NULL DEFAULT 'ready_made';

      CREATE TABLE IF NOT EXISTS product_media (
        id SERIAL PRIMARY KEY,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        url TEXT NOT NULL,
        kind TEXT NOT NULL DEFAULT 'gallery',
        alt_text TEXT NOT NULL DEFAULT '',
        sort_order INTEGER NOT NULL DEFAULT 0,
        is_primary INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS product_media_product_url_uidx ON product_media(product_id, url);
      CREATE INDEX IF NOT EXISTS product_media_product_sort_idx ON product_media(product_id, sort_order);

      CREATE TABLE IF NOT EXISTS product_sizes (
        id SERIAL PRIMARY KEY,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        legacy_id TEXT NOT NULL,
        name TEXT NOT NULL,
        pack_size INTEGER NOT NULL DEFAULT 1,
        unit_label TEXT NOT NULL DEFAULT 'piece',
        min_qty INTEGER NOT NULL DEFAULT 1,
        media_id INTEGER REFERENCES product_media(id) ON DELETE SET NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS product_sizes_product_legacy_uidx ON product_sizes(product_id, legacy_id);
      CREATE INDEX IF NOT EXISTS product_sizes_product_sort_idx ON product_sizes(product_id, sort_order);

      CREATE TABLE IF NOT EXISTS product_size_price_tiers (
        id SERIAL PRIMARY KEY,
        size_id INTEGER NOT NULL REFERENCES product_sizes(id) ON DELETE CASCADE,
        qty_from INTEGER NOT NULL DEFAULT 1,
        qty_to INTEGER,
        price_per_unit NUMERIC(12, 2) NOT NULL DEFAULT 0,
        sort_order INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS product_size_price_tiers_size_idx ON product_size_price_tiers(size_id, qty_from);

      CREATE TABLE IF NOT EXISTS product_option_groups (
        id SERIAL PRIMARY KEY,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        legacy_id TEXT NOT NULL,
        title TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS product_option_groups_product_legacy_uidx ON product_option_groups(product_id, legacy_id);
      CREATE INDEX IF NOT EXISTS product_option_groups_product_sort_idx ON product_option_groups(product_id, sort_order);

      CREATE TABLE IF NOT EXISTS product_option_choices (
        id SERIAL PRIMARY KEY,
        group_id INTEGER NOT NULL REFERENCES product_option_groups(id) ON DELETE CASCADE,
        legacy_id TEXT NOT NULL,
        name TEXT NOT NULL,
        base_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
        charge_type TEXT NOT NULL DEFAULT 'flat',
        media_id INTEGER REFERENCES product_media(id) ON DELETE SET NULL,
        sort_order INTEGER NOT NULL DEFAULT 0
      );
      CREATE UNIQUE INDEX IF NOT EXISTS product_option_choices_group_legacy_uidx ON product_option_choices(group_id, legacy_id);
      CREATE INDEX IF NOT EXISTS product_option_choices_group_sort_idx ON product_option_choices(group_id, sort_order);

      CREATE TABLE IF NOT EXISTS product_choice_size_prices (
        id SERIAL PRIMARY KEY,
        choice_id INTEGER NOT NULL REFERENCES product_option_choices(id) ON DELETE CASCADE,
        size_id INTEGER NOT NULL REFERENCES product_sizes(id) ON DELETE CASCADE,
        price NUMERIC(12, 2) NOT NULL DEFAULT 0
      );
      CREATE UNIQUE INDEX IF NOT EXISTS product_choice_size_prices_choice_size_uidx ON product_choice_size_prices(choice_id, size_id);
      CREATE TABLE IF NOT EXISTS product_catalog_migrations (
        version INTEGER PRIMARY KEY,
        completed_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    log("[migrations] Schema columns and normalized product catalog verified/added successfully");

    // Indexes for reports date-range queries.
    // Partial (WHERE deleted_at IS NULL) keeps index size small and matches
    // the deleted_at IS NULL filter used in every reports query.
    // Composite indexes cover both the range predicate and the GROUP BY /
    // JOIN column used in the clients CTE aggregations.
    await client.query(`
      -- Orders: range scans for orders/clients reports
      CREATE INDEX IF NOT EXISTS idx_orders_created_at_active
        ON orders(created_at DESC) WHERE deleted_at IS NULL;
      -- Composite: covers created_at range filter + GROUP BY customer_phone
      -- (used by range_orders CTE in clients report)
      CREATE INDEX IF NOT EXISTS idx_orders_date_phone_active
        ON orders(created_at, customer_phone) WHERE deleted_at IS NULL;
      -- Supports all_orders CTE (lifetime phone-based aggregation)
      CREATE INDEX IF NOT EXISTS idx_orders_phone_active
        ON orders(customer_phone) WHERE deleted_at IS NULL;

      -- Invoices: range scans for invoices/clients reports
      CREATE INDEX IF NOT EXISTS idx_invoices_created_at_active
        ON invoices(created_at DESC) WHERE deleted_at IS NULL;
      -- Composite: covers created_at range filter + GROUP BY client_id
      -- (used by range_invoices CTE in clients report)
      CREATE INDEX IF NOT EXISTS idx_invoices_date_client_active
        ON invoices(created_at, client_id) WHERE deleted_at IS NULL;
      -- Supports all_invoices CTE (lifetime client-based aggregation)
      CREATE INDEX IF NOT EXISTS idx_invoices_client_active
        ON invoices(client_id) WHERE deleted_at IS NULL;

      -- Clients: range scans for clients report
      CREATE INDEX IF NOT EXISTS idx_clients_created_at_active
        ON clients(created_at DESC) WHERE deleted_at IS NULL;
    `);
    log("[migrations] Report indexes verified/created");
  } catch (e) {
    // Log but don't crash — the app can still serve requests even if migration fails
    console.warn("[migrations] Startup migration warning:", e);
  }

  // Backfill is isolated from the DDL block: a single bad metadata row must
  // never poison the schema migration on cold start. We pull only the rows
  // that actually need filling, parse each metadata blob in JS (so a single
  // malformed row simply gets skipped instead of aborting the batch), and
  // issue a targeted UPDATE per row only if we found something useful.
  try {
    const { rows } = await client.query(
      `SELECT id, metadata
         FROM invoices
        WHERE metadata IS NOT NULL
          AND metadata <> ''
          AND (client_phone IS NULL OR client_email IS NULL)`,
    );
    let backfilled = 0;
    for (const row of rows as Array<{ id: number; metadata: string }>) {
      let parsed: any;
      try {
        parsed = JSON.parse(row.metadata);
      } catch {
        continue; // skip rows whose metadata isn't valid JSON
      }
      const form = parsed?.form ?? {};
      const phone = typeof form.phone === "string" ? form.phone.trim() : "";
      const email = typeof form.email === "string" ? form.email.trim() : "";
      if (!phone && !email) continue;
      const result = await client.query(
        `UPDATE invoices
            SET client_phone = COALESCE(client_phone, $2),
                client_email = COALESCE(client_email, $3)
          WHERE id = $1
            AND (client_phone IS NULL OR client_email IS NULL)`,
        [row.id, phone || null, email || null],
      );
      if (result.rowCount && result.rowCount > 0) backfilled += 1;
    }
    if (backfilled > 0) {
      log(
        `[migrations] Backfilled client_phone/client_email on ${backfilled} legacy invoice row(s)`,
      );
    }
  } catch (e) {
    console.warn("[migrations] Invoice contact backfill warning:", e);
  } finally {
    client.release();
  }

  // Backfill the normalized product catalog once. A marker makes startup fast
  // after the first successful run, and leaving the marker absent makes a
  // failed backfill retry safely on the next restart.
  const catalogClient = await pool.connect();
  try {
    const marker = await catalogClient.query(
      `SELECT version FROM product_catalog_migrations WHERE version = 1 LIMIT 1`,
    );
    if (marker.rowCount === 0) {
      await syncAllNormalizedProductCatalog();
      await catalogClient.query(
        `INSERT INTO product_catalog_migrations (version) VALUES (1) ON CONFLICT (version) DO NOTHING`,
      );
      log("[migrations] Normalized product catalog backfill completed");
    }
  } catch (e) {
    console.warn("[migrations] Normalized product catalog backfill warning:", e);
  } finally {
    catalogClient.release();
  }

  // Status-from-advance reconciliation: any invoice that's flagged as
  // `issued`, `pending`, or `draft` but whose metadata records a positive
  // `advance` should already be at `partial` (or `paid` if the advance
  // covers the full amount). This fixes legacy rows that were saved before
  // `deriveInvoiceStatus` was tightened to make money-received take
  // precedence over a manual `issued` tag, so realised-revenue tiles
  // immediately reflect those advances.
  const reconcileClient = await pool.connect();
  try {
    const { rows } = await reconcileClient.query(
      `SELECT id, amount, status, metadata
         FROM invoices
        WHERE deleted_at IS NULL
          AND status IN ('issued', 'pending', 'draft')
          AND metadata IS NOT NULL
          AND metadata <> ''`,
    );
    let reconciled = 0;
    for (const row of rows as Array<{
      id: number;
      amount: string | null;
      status: string;
      metadata: string;
    }>) {
      let parsed: any;
      try {
        parsed = JSON.parse(row.metadata);
      } catch {
        continue;
      }
      const adv = Number(parsed?.advance ?? 0);
      const total = Number(row.amount ?? 0);
      if (!Number.isFinite(adv) || adv <= 0) continue;
      const target =
        Number.isFinite(total) && total > 0 && adv >= total
          ? "paid"
          : "partial";
      if (target === row.status) continue;
      const result = await reconcileClient.query(
        `UPDATE invoices SET status = $2 WHERE id = $1 AND status = $3`,
        [row.id, target, row.status],
      );
      if (result.rowCount && result.rowCount > 0) reconciled += 1;
    }
    if (reconciled > 0) {
      log(
        `[migrations] Reconciled status on ${reconciled} legacy invoice row(s) ` +
          `(advance > 0 → partial/paid)`,
      );
    }
  } catch (e) {
    console.warn("[migrations] Invoice status reconciliation warning:", e);
  } finally {
    reconcileClient.release();
  }

  // Auto-purge: permanently delete items that have been in trash for over 30 days
  const purgeClient = await pool.connect();
  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const tables = ["orders", "invoices", "clients", "crm_projects"] as const;
    let totalPurged = 0;
    for (const table of tables) {
      const result = await purgeClient.query(
        `DELETE FROM ${table} WHERE deleted_at IS NOT NULL AND deleted_at < $1`,
        [cutoff],
      );
      totalPurged += result.rowCount ?? 0;
    }
    if (totalPurged > 0) {
      log(
        `[migrations] Auto-purged ${totalPurged} expired trash item(s) (older than 30 days)`,
      );
    }
  } catch (e) {
    console.warn("[migrations] Trash auto-purge warning:", e);
  } finally {
    purgeClient.release();
  }
}
