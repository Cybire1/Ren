ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "table" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "payer_address" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "reward" jsonb;--> statement-breakpoint
ALTER TABLE "stalls" ADD COLUMN IF NOT EXISTS "table_count" integer;--> statement-breakpoint
ALTER TABLE "stalls" ADD COLUMN IF NOT EXISTS "loyalty_every" integer;