CREATE TABLE "kv_store" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"expires_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sponsorships" (
	"id" uuid PRIMARY KEY NOT NULL,
	"wallet" text NOT NULL,
	"kind" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "kv_store_expires_idx" ON "kv_store" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "sponsorships_wallet_idx" ON "sponsorships" USING btree ("wallet","kind","created_at");