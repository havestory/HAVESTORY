ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "hero_slide_image6" text;
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "hero_slide_image7" text;
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "hero_slide_image8" text;
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "hero_slide_image9" text;
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "hero_slide_image10" text;
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "hero_slide_enabled" text DEFAULT '[true,true,true,true,true,true,true,true,true,true]' NOT NULL;
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "home_feature_cards" text DEFAULT '[]' NOT NULL;
