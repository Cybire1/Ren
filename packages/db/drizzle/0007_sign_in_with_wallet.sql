CREATE TABLE "sign_in_challenges" (
	"nonce" text PRIMARY KEY NOT NULL,
	"address" text NOT NULL,
	"purpose" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "merchants" ADD COLUMN "owner_address" text;--> statement-breakpoint
CREATE INDEX "merchants_owner_idx" ON "merchants" USING btree ("owner_address");