import { pool } from "@workspace/db";

const SCHEMA_VERSION = "2026-08-12-core-v2";
let runtimeSchemaReady: Promise<void> | null = null;

async function versionExists(version: string): Promise<boolean> {
  try {
    const result = await pool.query("SELECT 1 FROM app_schema_versions WHERE version = $1", [version]);
    return result.rowCount === 1;
  } catch (error: any) {
    // 42P01 = app_schema_versions has not been created yet.
    if (error?.code === "42P01") return false;
    throw error;
  }
}

async function applyRuntimeSchema(): Promise<void> {
  if (await versionExists(SCHEMA_VERSION)) return;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Serialise the one-time repair across simultaneous Vercel cold starts.
    await client.query("SELECT pg_advisory_xact_lock(hashtext('havestory-runtime-schema'))");
    await client.query(`
      CREATE TABLE IF NOT EXISTS app_schema_versions (
        version TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    const existing = await client.query("SELECT 1 FROM app_schema_versions WHERE version = $1", [SCHEMA_VERSION]);
    if (existing.rowCount === 1) {
      await client.query("COMMIT");
      return;
    }

    // Core public/admin tables. These statements only add missing structures;
    // they never delete, truncate or overwrite existing business data.
    await client.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
        image_url TEXT, sort_order INTEGER NOT NULL DEFAULT 0, created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY, category_id INTEGER, name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '', price TEXT NOT NULL DEFAULT '0',
        price_type TEXT NOT NULL DEFAULT 'per_item', image_url TEXT, gallery_images TEXT,
        artwork_guide_url TEXT, artwork_guide_name TEXT, featured BOOLEAN NOT NULL DEFAULT FALSE,
        active BOOLEAN NOT NULL DEFAULT TRUE, sort_order INTEGER NOT NULL DEFAULT 0,
        custom_config TEXT, invoice_name TEXT, created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      ALTER TABLE products
        ADD COLUMN IF NOT EXISTS category_id INTEGER,
        ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '',
        ADD COLUMN IF NOT EXISTS price TEXT NOT NULL DEFAULT '0',
        ADD COLUMN IF NOT EXISTS price_type TEXT NOT NULL DEFAULT 'per_item',
        ADD COLUMN IF NOT EXISTS image_url TEXT,
        ADD COLUMN IF NOT EXISTS gallery_images TEXT,
        ADD COLUMN IF NOT EXISTS artwork_guide_url TEXT,
        ADD COLUMN IF NOT EXISTS artwork_guide_name TEXT,
        ADD COLUMN IF NOT EXISTS featured BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE,
        ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS custom_config TEXT,
        ADD COLUMN IF NOT EXISTS invoice_name TEXT,
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT NOW();

      CREATE TABLE IF NOT EXISTS reviews (
        id SERIAL PRIMARY KEY, customer_name TEXT NOT NULL, rating INTEGER NOT NULL,
        comment TEXT NOT NULL, photo_url TEXT, approved BOOLEAN NOT NULL DEFAULT FALSE,
        featured BOOLEAN NOT NULL DEFAULT FALSE, created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS settings (id SERIAL PRIMARY KEY);
      ALTER TABLE settings
        ADD COLUMN IF NOT EXISTS business_name TEXT NOT NULL DEFAULT 'HAVESTORY',
        ADD COLUMN IF NOT EXISTS tagline TEXT NOT NULL DEFAULT 'Premium Photo Frames & Story Galleries',
        ADD COLUMN IF NOT EXISTS hero_title TEXT NOT NULL DEFAULT 'Frame the Moments That Stay',
        ADD COLUMN IF NOT EXISTS hero_subtitle TEXT NOT NULL DEFAULT 'Thoughtfully made photo frames that turn everyday moments into a gallery of your own.',
        ADD COLUMN IF NOT EXISTS whatsapp_number TEXT NOT NULL DEFAULT '94700000000',
        ADD COLUMN IF NOT EXISTS whatsapp_message TEXT NOT NULL DEFAULT 'Hi! I would like to place an order with HAVESTORY.',
        ADD COLUMN IF NOT EXISTS about_story TEXT NOT NULL DEFAULT '',
        ADD COLUMN IF NOT EXISTS about_mission TEXT NOT NULL DEFAULT '',
        ADD COLUMN IF NOT EXISTS about_image TEXT,
        ADD COLUMN IF NOT EXISTS orders_completed_count INTEGER NOT NULL DEFAULT 10,
        ADD COLUMN IF NOT EXISTS happy_clients_percent INTEGER NOT NULL DEFAULT 99,
        ADD COLUMN IF NOT EXISTS star_rating REAL NOT NULL DEFAULT 5,
        ADD COLUMN IF NOT EXISTS facebook_url TEXT,
        ADD COLUMN IF NOT EXISTS instagram_url TEXT,
        ADD COLUMN IF NOT EXISTS address TEXT,
        ADD COLUMN IF NOT EXISTS email TEXT,
        ADD COLUMN IF NOT EXISTS phone TEXT,
        ADD COLUMN IF NOT EXISTS website TEXT,
        ADD COLUMN IF NOT EXISTS bank_name TEXT,
        ADD COLUMN IF NOT EXISTS bank_account_holder TEXT,
        ADD COLUMN IF NOT EXISTS bank_account_number TEXT,
        ADD COLUMN IF NOT EXISTS bank_branch TEXT,
        ADD COLUMN IF NOT EXISTS bank_swift_bic TEXT,
        ADD COLUMN IF NOT EXISTS payment_due_days INTEGER NOT NULL DEFAULT 7,
        ADD COLUMN IF NOT EXISTS overdue_days INTEGER NOT NULL DEFAULT 30,
        ADD COLUMN IF NOT EXISTS terms_conditions TEXT,
        ADD COLUMN IF NOT EXISTS courier_services TEXT NOT NULL DEFAULT '[]',
        ADD COLUMN IF NOT EXISTS hero_bg_image TEXT,
        ADD COLUMN IF NOT EXISTS hero_cta_text TEXT NOT NULL DEFAULT 'Find Your Frame',
        ADD COLUMN IF NOT EXISTS hero_cta_link TEXT NOT NULL DEFAULT '/custom-project',
        ADD COLUMN IF NOT EXISTS hero_badge_text TEXT NOT NULL DEFAULT 'Premium Photo Frames - Made in Sri Lanka',
        ADD COLUMN IF NOT EXISTS hero_highlight_word TEXT NOT NULL DEFAULT 'Matters',
        ADD COLUMN IF NOT EXISTS about_vision TEXT,
        ADD COLUMN IF NOT EXISTS about_founded_year TEXT NOT NULL DEFAULT '2020',
        ADD COLUMN IF NOT EXISTS about_team_size TEXT NOT NULL DEFAULT '10+',
        ADD COLUMN IF NOT EXISTS about_location TEXT NOT NULL DEFAULT 'Sri Lanka',
        ADD COLUMN IF NOT EXISTS privacy_policy TEXT,
        ADD COLUMN IF NOT EXISTS terms_of_service TEXT,
        ADD COLUMN IF NOT EXISTS seo_title TEXT NOT NULL DEFAULT 'HAVESTORY - Premium Custom Photo Frames Sri Lanka',
        ADD COLUMN IF NOT EXISTS seo_description TEXT NOT NULL DEFAULT '',
        ADD COLUMN IF NOT EXISTS seo_keywords TEXT NOT NULL DEFAULT '',
        ADD COLUMN IF NOT EXISTS seo_og_image TEXT,
        ADD COLUMN IF NOT EXISTS theme_preset TEXT NOT NULL DEFAULT 'havestory-gallery',
        ADD COLUMN IF NOT EXISTS hero_avatar_image1 TEXT,
        ADD COLUMN IF NOT EXISTS hero_avatar_image2 TEXT,
        ADD COLUMN IF NOT EXISTS hero_avatar_image3 TEXT,
        ADD COLUMN IF NOT EXISTS hero_avatar_image4 TEXT,
        ADD COLUMN IF NOT EXISTS designer_credit TEXT NOT NULL DEFAULT 'HAVESTORY',
        ADD COLUMN IF NOT EXISTS owner_name TEXT,
        ADD COLUMN IF NOT EXISTS logo_url TEXT,
        ADD COLUMN IF NOT EXISTS tiktok_url TEXT,
        ADD COLUMN IF NOT EXISTS bank_details TEXT NOT NULL DEFAULT '[]',
        ADD COLUMN IF NOT EXISTS courier_charge TEXT NOT NULL DEFAULT '450',
        ADD COLUMN IF NOT EXISTS sl_post_charge TEXT NOT NULL DEFAULT '250',
        ADD COLUMN IF NOT EXISTS invoice_standard_rate TEXT NOT NULL DEFAULT '350',
        ADD COLUMN IF NOT EXISTS invoice_express_rate TEXT NOT NULL DEFAULT '530',
        ADD COLUMN IF NOT EXISTS invoice_weight_first_kg TEXT NOT NULL DEFAULT '450',
        ADD COLUMN IF NOT EXISTS invoice_weight_add_kg TEXT NOT NULL DEFAULT '200',
        ADD COLUMN IF NOT EXISTS tagline_enabled INTEGER NOT NULL DEFAULT 1,
        ADD COLUMN IF NOT EXISTS show_name_with_logo INTEGER NOT NULL DEFAULT 1,
        ADD COLUMN IF NOT EXISTS favicon_url TEXT,
        ADD COLUMN IF NOT EXISTS whatsapp_order_template TEXT NOT NULL DEFAULT 'Thank you for choosing HAVESTORY.',
        ADD COLUMN IF NOT EXISTS hero_slide_image1 TEXT,
        ADD COLUMN IF NOT EXISTS hero_slide_image2 TEXT,
        ADD COLUMN IF NOT EXISTS hero_slide_image3 TEXT,
        ADD COLUMN IF NOT EXISTS hero_slide_image4 TEXT,
        ADD COLUMN IF NOT EXISTS hero_slide_image5 TEXT,
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
        ADD COLUMN IF NOT EXISTS order_email_notifications_enabled INTEGER NOT NULL DEFAULT 1,
        ADD COLUMN IF NOT EXISTS order_email_recipients TEXT NOT NULL DEFAULT '',
        ADD COLUMN IF NOT EXISTS gmail_user TEXT,
        ADD COLUMN IF NOT EXISTS gmail_app_password TEXT,
        ADD COLUMN IF NOT EXISTS finance_report_email_enabled INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS finance_report_email_recipient TEXT,
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT NOW();

      DO $$ BEGIN
        IF to_regclass('public.orders') IS NOT NULL THEN ALTER TABLE orders ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP; END IF;
        IF to_regclass('public.invoices') IS NOT NULL THEN ALTER TABLE invoices ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP; END IF;
        IF to_regclass('public.clients') IS NOT NULL THEN ALTER TABLE clients ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP; END IF;
        IF to_regclass('public.crm_projects') IS NOT NULL THEN ALTER TABLE crm_projects ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP; END IF;
      END $$;
    `);

    await client.query("INSERT INTO app_schema_versions(version) VALUES ($1)", [SCHEMA_VERSION]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export function ensureRuntimeSchema(): Promise<void> {
  if (!runtimeSchemaReady) {
    runtimeSchemaReady = applyRuntimeSchema().catch(error => {
      runtimeSchemaReady = null;
      throw error;
    });
  }
  return runtimeSchemaReady;
}
