CREATE TABLE "categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"image_url" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"category_id" integer,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"price" text DEFAULT '0' NOT NULL,
	"price_type" text DEFAULT 'per_item' NOT NULL,
	"image_url" text,
	"gallery_images" text,
	"artwork_guide_url" text,
	"artwork_guide_name" text,
	"featured" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"custom_config" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"price" text,
	"price_type" text DEFAULT 'custom_quote' NOT NULL,
	"package_details" text,
	"highlights" text DEFAULT '[]' NOT NULL,
	"image_url" text,
	"featured" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"category_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portfolio" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"category" text NOT NULL,
	"client_name" text,
	"description" text DEFAULT '' NOT NULL,
	"image_url" text,
	"gallery_images" text DEFAULT '[]' NOT NULL,
	"tags" text DEFAULT '[]' NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"completed_at" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"customer_name" text NOT NULL,
	"customer_phone" text NOT NULL,
	"customer_email" text,
	"customer_address" text NOT NULL,
	"order_type" text DEFAULT 'standard' NOT NULL,
	"items" text DEFAULT '[]' NOT NULL,
	"design_links" text DEFAULT '[]' NOT NULL,
	"attachments" text DEFAULT '[]' NOT NULL,
	"status" text DEFAULT 'submitted' NOT NULL,
	"admin_notes" text,
	"estimated_completion" text,
	"status_history" text DEFAULT '[]' NOT NULL,
	"delivery_method" text,
	"courier_name" text,
	"courier_tracking_number" text,
	"online_delivery_files" text DEFAULT '[]' NOT NULL,
	"online_delivery_links" text DEFAULT '[]' NOT NULL,
	"order_description" text,
	"shipping_method" text,
	"payment_proof_url" text,
	"proof_file_url" text,
	"proof_file_name" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "orders_order_id_unique" UNIQUE("order_id")
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_name" text NOT NULL,
	"rating" integer NOT NULL,
	"comment" text NOT NULL,
	"photo_url" text,
	"approved" boolean DEFAULT false NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"message_id" text NOT NULL,
	"full_name" text NOT NULL,
	"phone" text NOT NULL,
	"email" text,
	"subject" text NOT NULL,
	"message" text NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "messages_message_id_unique" UNIQUE("message_id")
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"business_name" text,
	"email" text,
	"phone" text,
	"address" text,
	"approved" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notice" (
	"id" serial PRIMARY KEY NOT NULL,
	"enabled" integer DEFAULT 0 NOT NULL,
	"message" text DEFAULT '' NOT NULL,
	"type" text DEFAULT 'info' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notices" (
	"id" serial PRIMARY KEY NOT NULL,
	"message" text DEFAULT '' NOT NULL,
	"style" text DEFAULT 'info' NOT NULL,
	"placement" text DEFAULT 'banner' NOT NULL,
	"enabled" integer DEFAULT 1 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"topic" text,
	"image_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"business_name" text DEFAULT 'HAVESTORY' NOT NULL,
	"tagline" text DEFAULT 'Studio, Colour Lab & Fine Framing' NOT NULL,
	"hero_title" text DEFAULT 'Capturing Stories. Framing Memories.' NOT NULL,
	"hero_subtitle" text DEFAULT 'Archival photo prints, studio services and made-to-fit frames crafted with care.' NOT NULL,
	"whatsapp_number" text DEFAULT '94700000000' NOT NULL,
	"whatsapp_message" text DEFAULT 'Hi! I''d like to start a photo, print or frame project with HAVESTORY.' NOT NULL,
	"about_story" text DEFAULT 'HAVESTORY is an independent photography studio, colour lab and framing workshop dedicated to preserving meaningful images.' NOT NULL,
	"about_mission" text DEFAULT 'Our mission is to turn photographs into beautifully printed and framed stories that last.' NOT NULL,
	"about_image" text,
	"orders_completed_count" integer DEFAULT 10 NOT NULL,
	"happy_clients_percent" integer DEFAULT 99 NOT NULL,
	"star_rating" real DEFAULT 5 NOT NULL,
	"facebook_url" text,
	"instagram_url" text,
	"address" text,
	"email" text,
	"phone" text,
	"website" text,
	"bank_name" text,
	"bank_account_holder" text,
	"bank_account_number" text,
	"bank_branch" text,
	"bank_swift_bic" text,
	"payment_due_days" integer DEFAULT 7 NOT NULL,
	"terms_conditions" text,
	"courier_services" text DEFAULT '[]' NOT NULL,
	"hero_bg_image" text,
	"hero_cta_text" text DEFAULT 'Start Your Order' NOT NULL,
	"hero_cta_link" text DEFAULT '/custom-project' NOT NULL,
	"hero_badge_text" text DEFAULT 'Premium Photo Studio & Colour Lab' NOT NULL,
	"hero_highlight_word" text DEFAULT 'Memories' NOT NULL,
	"about_vision" text,
	"about_founded_year" text DEFAULT '2020' NOT NULL,
	"about_team_size" text DEFAULT '10+' NOT NULL,
	"about_location" text DEFAULT 'Sri Lanka' NOT NULL,
	"privacy_policy" text,
	"terms_of_service" text,
	"seo_title" text DEFAULT 'HAVESTORY — Photo Studio, Colour Lab & Fine Framing' NOT NULL,
	"seo_description" text DEFAULT 'HAVESTORY creates archival photo prints, studio portraits, story collages and made-to-fit frames in Sri Lanka.' NOT NULL,
	"seo_keywords" text DEFAULT 'photo studio sri lanka, colour lab, photo frames, archival prints, studio portraits, havestory' NOT NULL,
	"seo_og_image" text,
	"theme_preset" text DEFAULT 'havestory-gallery' NOT NULL,
	"hero_avatar_image1" text,
	"hero_avatar_image2" text,
	"hero_avatar_image3" text,
	"hero_avatar_image4" text,
	"designer_credit" text DEFAULT 'CODEARTIX' NOT NULL,
	"owner_name" text,
	"logo_url" text,
	"tiktok_url" text,
	"bank_details" text DEFAULT '[]' NOT NULL,
	"courier_charge" text DEFAULT '450' NOT NULL,
	"sl_post_charge" text DEFAULT '250' NOT NULL,
	"invoice_standard_rate" text DEFAULT '350' NOT NULL,
	"invoice_express_rate" text DEFAULT '530' NOT NULL,
	"invoice_weight_first_kg" text DEFAULT '450' NOT NULL,
	"invoice_weight_add_kg" text DEFAULT '200' NOT NULL,
	"tagline_enabled" integer DEFAULT 1 NOT NULL,
	"show_name_with_logo" integer DEFAULT 1 NOT NULL,
	"favicon_url" text,
	"whatsapp_order_template" text DEFAULT 'Hi {customerName}!

Thank you for choosing *HAVESTORY*! Your order has been received and is being processed.

Order Number: *{orderNumber}*

Track your order status here:
{trackingLink}

If you have any questions, feel free to contact us anytime.

Warm regards,
*HAVESTORY*' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" serial PRIMARY KEY NOT NULL,
	"invoice_number" text NOT NULL,
	"client_name" text NOT NULL,
	"order_id" text,
	"amount" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"due_date" text,
	"notes" text,
	"metadata" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_invoice_number_unique" UNIQUE("invoice_number")
);
--> statement-breakpoint
CREATE TABLE "inventory" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"quantity" integer DEFAULT 0 NOT NULL,
	"unit" text DEFAULT 'units' NOT NULL,
	"low_stock_threshold" integer DEFAULT 10 NOT NULL,
	"cost" text,
	"supplier" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"title" text NOT NULL,
	"client_name" text NOT NULL,
	"client_id" integer,
	"status" text DEFAULT 'planning' NOT NULL,
	"description" text,
	"total_value" integer DEFAULT 0,
	"amount_paid" integer DEFAULT 0,
	"start_date" text,
	"due_date" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "crm_projects_project_id_unique" UNIQUE("project_id")
);
