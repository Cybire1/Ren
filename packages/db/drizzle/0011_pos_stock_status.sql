ALTER TABLE "catalog_items" ADD COLUMN "stock" integer;--> statement-breakpoint
ALTER TABLE "catalog_items" ADD COLUMN "category" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "status" text DEFAULT 'new' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "stock_taken_at" timestamp with time zone;--> statement-breakpoint
UPDATE "orders" SET "status" = 'collected' WHERE "collected_at" IS NOT NULL;--> statement-breakpoint
UPDATE "orders" SET "stock_taken_at" = now();
