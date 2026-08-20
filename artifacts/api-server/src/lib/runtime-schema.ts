import { pool } from "@workspace/db";

const SCHEMA_VERSION = "2026-08-20-checkout-payment-columns-v1";
let runtimeSchemaReady: Promise<void> | null = null;

async function versionExists(version: string): Promise<boolean> {
  try {
    const result = await pool.query(
      "SELECT 1 FROM app_schema_versions WHERE version = $1",
      [version],
    );
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
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext('havestory-runtime-schema'))",
    );
    await client.query(`
      CREATE TABLE IF NOT EXISTS app_schema_versions (
        version TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    const existing = await client.query(
      "SELECT 1 FROM app_schema_versions WHERE version = $1",
      [SCHEMA_VERSION],
    );
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
      ALTER TABLE categories
        ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '',
        ADD COLUMN IF NOT EXISTS image_url TEXT,
        ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT NOW();
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
      ALTER TABLE reviews
        ADD COLUMN IF NOT EXISTS photo_url TEXT,
        ADD COLUMN IF NOT EXISTS approved BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS featured BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT NOW();

      CREATE TABLE IF NOT EXISTS service_categories (
        id SERIAL PRIMARY KEY, name TEXT NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      ALTER TABLE service_categories
        ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT NOW();
      CREATE TABLE IF NOT EXISTS services (
        id SERIAL PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
        price TEXT, price_type TEXT NOT NULL DEFAULT 'custom_quote', package_details TEXT,
        highlights TEXT NOT NULL DEFAULT '[]', image_url TEXT,
        featured BOOLEAN NOT NULL DEFAULT FALSE, active BOOLEAN NOT NULL DEFAULT TRUE,
        sort_order INTEGER NOT NULL DEFAULT 0, category_id INTEGER,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      ALTER TABLE services
        ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '',
        ADD COLUMN IF NOT EXISTS price TEXT,
        ADD COLUMN IF NOT EXISTS price_type TEXT NOT NULL DEFAULT 'custom_quote',
        ADD COLUMN IF NOT EXISTS package_details TEXT,
        ADD COLUMN IF NOT EXISTS highlights TEXT NOT NULL DEFAULT '[]',
        ADD COLUMN IF NOT EXISTS image_url TEXT,
        ADD COLUMN IF NOT EXISTS featured BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE,
        ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS category_id INTEGER,
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT NOW();
      CREATE TABLE IF NOT EXISTS clients (
        id SERIAL PRIMARY KEY, name TEXT NOT NULL, business_name TEXT, email TEXT,
        phone TEXT, address TEXT, approved BOOLEAN NOT NULL DEFAULT TRUE, notes TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(), updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMP
      );
      ALTER TABLE clients
        ADD COLUMN IF NOT EXISTS business_name TEXT,
        ADD COLUMN IF NOT EXISTS email TEXT,
        ADD COLUMN IF NOT EXISTS phone TEXT,
        ADD COLUMN IF NOT EXISTS address TEXT,
        ADD COLUMN IF NOT EXISTS approved BOOLEAN NOT NULL DEFAULT TRUE,
        ADD COLUMN IF NOT EXISTS notes TEXT,
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY, order_id TEXT NOT NULL UNIQUE, customer_name TEXT NOT NULL,
        customer_phone TEXT NOT NULL, customer_email TEXT, customer_address TEXT NOT NULL DEFAULT '',
        order_type TEXT NOT NULL DEFAULT 'standard', items TEXT NOT NULL DEFAULT '[]',
        design_links TEXT NOT NULL DEFAULT '[]', attachments TEXT NOT NULL DEFAULT '[]',
        status TEXT NOT NULL DEFAULT 'submitted', admin_notes TEXT, estimated_completion TEXT,
        status_history TEXT NOT NULL DEFAULT '[]', delivery_method TEXT, courier_name TEXT,
        courier_tracking_number TEXT, online_delivery_files TEXT NOT NULL DEFAULT '[]',
        online_delivery_links TEXT NOT NULL DEFAULT '[]', order_description TEXT,
        shipping_method TEXT, payment_proof_url TEXT, proof_file_url TEXT, proof_file_name TEXT,
        payment_method TEXT NOT NULL DEFAULT 'bank_transfer', payment_status TEXT NOT NULL DEFAULT 'pending',
        payment_amount INTEGER NOT NULL DEFAULT 0, payment_proof_status TEXT NOT NULL DEFAULT 'not_uploaded',
        payment_proof_uploaded_at TIMESTAMP, payment_proof_expires_at TIMESTAMP,
        payment_approved_at TIMESTAMP, payment_rejection_reason TEXT, customer_payment_confirmed_at TIMESTAMP,
        service_type_id INTEGER, due_date TEXT, start_date TEXT, priority TEXT,
        discount_amount INTEGER NOT NULL DEFAULT 0, advance_paid INTEGER NOT NULL DEFAULT 0,
        tags TEXT NOT NULL DEFAULT '[]', created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(), deleted_at TIMESTAMP
      );
      ALTER TABLE orders
        ADD COLUMN IF NOT EXISTS order_id TEXT,
        ADD COLUMN IF NOT EXISTS customer_name TEXT NOT NULL DEFAULT 'Customer',
        ADD COLUMN IF NOT EXISTS customer_phone TEXT NOT NULL DEFAULT '',
        ADD COLUMN IF NOT EXISTS customer_email TEXT,
        ADD COLUMN IF NOT EXISTS customer_address TEXT NOT NULL DEFAULT '',
        ADD COLUMN IF NOT EXISTS order_type TEXT NOT NULL DEFAULT 'standard',
        ADD COLUMN IF NOT EXISTS items TEXT NOT NULL DEFAULT '[]',
        ADD COLUMN IF NOT EXISTS design_links TEXT NOT NULL DEFAULT '[]',
        ADD COLUMN IF NOT EXISTS attachments TEXT NOT NULL DEFAULT '[]',
        ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'submitted',
        ADD COLUMN IF NOT EXISTS admin_notes TEXT,
        ADD COLUMN IF NOT EXISTS estimated_completion TEXT,
        ADD COLUMN IF NOT EXISTS status_history TEXT NOT NULL DEFAULT '[]',
        ADD COLUMN IF NOT EXISTS delivery_method TEXT,
        ADD COLUMN IF NOT EXISTS courier_name TEXT,
        ADD COLUMN IF NOT EXISTS courier_tracking_number TEXT,
        ADD COLUMN IF NOT EXISTS online_delivery_files TEXT NOT NULL DEFAULT '[]',
        ADD COLUMN IF NOT EXISTS online_delivery_links TEXT NOT NULL DEFAULT '[]',
        ADD COLUMN IF NOT EXISTS order_description TEXT,
        ADD COLUMN IF NOT EXISTS shipping_method TEXT,
        ADD COLUMN IF NOT EXISTS payment_proof_url TEXT,
        ADD COLUMN IF NOT EXISTS proof_file_url TEXT,
        ADD COLUMN IF NOT EXISTS proof_file_name TEXT,
        ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'bank_transfer',
        ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'pending',
        ADD COLUMN IF NOT EXISTS payment_amount INTEGER NOT NULL DEFAULT 0,
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
        ADD COLUMN IF NOT EXISTS tags TEXT NOT NULL DEFAULT '[]',
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

      CREATE TABLE IF NOT EXISTS project_service_types (
        id SERIAL PRIMARY KEY, name TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      ALTER TABLE project_service_types
        ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT '',
        ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT NOW();

      CREATE TABLE IF NOT EXISTS crm_projects (
        id SERIAL PRIMARY KEY, project_id TEXT NOT NULL UNIQUE, title TEXT NOT NULL,
        client_name TEXT NOT NULL, client_id INTEGER, service_type_id INTEGER,
        status TEXT NOT NULL DEFAULT 'planning', description TEXT,
        total_value INTEGER DEFAULT 0, amount_paid INTEGER DEFAULT 0,
        start_date TEXT, due_date TEXT, notes TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(), deleted_at TIMESTAMP
      );
      ALTER TABLE crm_projects
        ADD COLUMN IF NOT EXISTS project_id TEXT,
        ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT '',
        ADD COLUMN IF NOT EXISTS client_name TEXT NOT NULL DEFAULT '',
        ADD COLUMN IF NOT EXISTS client_id INTEGER,
        ADD COLUMN IF NOT EXISTS service_type_id INTEGER,
        ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'planning',
        ADD COLUMN IF NOT EXISTS description TEXT,
        ADD COLUMN IF NOT EXISTS total_value INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS amount_paid INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS start_date TEXT,
        ADD COLUMN IF NOT EXISTS due_date TEXT,
        ADD COLUMN IF NOT EXISTS notes TEXT,
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

      CREATE TABLE IF NOT EXISTS invoices (
        id SERIAL PRIMARY KEY, invoice_number TEXT NOT NULL UNIQUE, client_name TEXT NOT NULL,
        client_id INTEGER, client_phone TEXT, client_email TEXT, order_id TEXT,
        amount TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', due_date TEXT,
        notes TEXT, metadata TEXT, created_at TIMESTAMP NOT NULL DEFAULT NOW(), deleted_at TIMESTAMP
      );
      ALTER TABLE invoices
        ADD COLUMN IF NOT EXISTS invoice_number TEXT,
        ADD COLUMN IF NOT EXISTS client_name TEXT NOT NULL DEFAULT 'Customer',
        ADD COLUMN IF NOT EXISTS client_id INTEGER,
        ADD COLUMN IF NOT EXISTS client_phone TEXT,
        ADD COLUMN IF NOT EXISTS client_email TEXT,
        ADD COLUMN IF NOT EXISTS order_id TEXT,
        ADD COLUMN IF NOT EXISTS amount TEXT NOT NULL DEFAULT '0',
        ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending',
        ADD COLUMN IF NOT EXISTS due_date TEXT,
        ADD COLUMN IF NOT EXISTS notes TEXT,
        ADD COLUMN IF NOT EXISTS metadata TEXT,
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

      CREATE TABLE IF NOT EXISTS inventory (
        id SERIAL PRIMARY KEY, name TEXT NOT NULL, description TEXT,
        quantity INTEGER NOT NULL DEFAULT 0, unit TEXT NOT NULL DEFAULT 'units',
        low_stock_threshold INTEGER NOT NULL DEFAULT 10, cost TEXT, supplier TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(), updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      ALTER TABLE inventory
        ADD COLUMN IF NOT EXISTS description TEXT,
        ADD COLUMN IF NOT EXISTS quantity INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS unit TEXT NOT NULL DEFAULT 'units',
        ADD COLUMN IF NOT EXISTS low_stock_threshold INTEGER NOT NULL DEFAULT 10,
        ADD COLUMN IF NOT EXISTS cost TEXT,
        ADD COLUMN IF NOT EXISTS supplier TEXT,
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT NOW();

      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY, message_id TEXT NOT NULL UNIQUE, full_name TEXT NOT NULL,
        phone TEXT NOT NULL DEFAULT '', email TEXT, subject TEXT NOT NULL DEFAULT '',
        message TEXT NOT NULL DEFAULT '', is_read BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      ALTER TABLE messages
        ADD COLUMN IF NOT EXISTS message_id TEXT,
        ADD COLUMN IF NOT EXISTS full_name TEXT NOT NULL DEFAULT 'Customer',
        ADD COLUMN IF NOT EXISTS phone TEXT NOT NULL DEFAULT '',
        ADD COLUMN IF NOT EXISTS email TEXT,
        ADD COLUMN IF NOT EXISTS subject TEXT NOT NULL DEFAULT '',
        ADD COLUMN IF NOT EXISTS message TEXT NOT NULL DEFAULT '',
        ADD COLUMN IF NOT EXISTS is_read BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT NOW();

      CREATE TABLE IF NOT EXISTS coupons (
        id SERIAL PRIMARY KEY, code TEXT NOT NULL UNIQUE,
        type TEXT NOT NULL DEFAULT 'percentage', value REAL NOT NULL,
        min_order REAL, max_uses INTEGER, used_count INTEGER NOT NULL DEFAULT 0,
        is_active INTEGER NOT NULL DEFAULT 1, expires_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS project_service_types (
        id SERIAL PRIMARY KEY, name TEXT NOT NULL UNIQUE,
        sort_order INTEGER NOT NULL DEFAULT 0, created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS admin_staff (
        id SERIAL PRIMARY KEY, name TEXT NOT NULL, username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL, permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
        active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(), last_login_at TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS admin_activity_log (
        id BIGSERIAL PRIMARY KEY, actor_type TEXT NOT NULL, actor_id INTEGER,
        actor_username TEXT NOT NULL, action TEXT NOT NULL, method TEXT NOT NULL,
        path TEXT NOT NULL, status_code INTEGER, created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS admin_activity_created_idx ON admin_activity_log(created_at DESC);
      CREATE INDEX IF NOT EXISTS admin_activity_actor_idx ON admin_activity_log(actor_id, created_at DESC);

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
        ADD COLUMN IF NOT EXISTS theme_preset TEXT NOT NULL DEFAULT 'light-premium',
        ADD COLUMN IF NOT EXISTS special_event_enabled INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS special_event_type TEXT NOT NULL DEFAULT 'none',
        ADD COLUMN IF NOT EXISTS special_event_message TEXT NOT NULL DEFAULT '',
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
        ADD COLUMN IF NOT EXISTS finance_report_email_recipient TEXT,
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT NOW();

      DO $$ BEGIN
        IF to_regclass('public.crm_projects') IS NOT NULL THEN
          ALTER TABLE crm_projects ADD COLUMN IF NOT EXISTS service_type_id INTEGER;
          ALTER TABLE crm_projects ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
        END IF;
      END $$;

      CREATE INDEX IF NOT EXISTS idx_orders_created_at_active ON orders(created_at DESC) WHERE deleted_at IS NULL;
      CREATE INDEX IF NOT EXISTS idx_orders_status_created ON orders(status, created_at DESC) WHERE deleted_at IS NULL;
      CREATE INDEX IF NOT EXISTS idx_invoices_created_at_active ON invoices(created_at DESC) WHERE deleted_at IS NULL;
      CREATE INDEX IF NOT EXISTS idx_invoices_status_created ON invoices(status, created_at DESC) WHERE deleted_at IS NULL;
      CREATE INDEX IF NOT EXISTS idx_clients_created_at_active ON clients(created_at DESC) WHERE deleted_at IS NULL;
    `);

    // Promote the former built-in themes once; future admin-selected themes remain untouched.
    await client.query(
      "UPDATE settings SET theme_preset = 'light-premium' WHERE theme_preset IN ('havestory-gallery', 'light-editorial')",
    );
    await client.query(
      "INSERT INTO settings (id, theme_preset, special_event_type) VALUES (1, 'light-premium', 'none') ON CONFLICT (id) DO NOTHING",
    );
    await client.query("INSERT INTO app_schema_versions(version) VALUES ($1)", [
      SCHEMA_VERSION,
    ]);
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
    runtimeSchemaReady = applyRuntimeSchema().catch((error) => {
      runtimeSchemaReady = null;
      throw error;
    });
  }
  return runtimeSchemaReady;
}
