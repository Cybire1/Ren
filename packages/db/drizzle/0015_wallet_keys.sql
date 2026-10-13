CREATE TYPE "public"."key_kind" AS ENUM('agent', 'allowance', 'card');--> statement-breakpoint
CREATE TABLE "key_payments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"wallet_key_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"origin" text,
	"url" text,
	"recipient" text NOT NULL,
	"amount" bigint NOT NULL,
	"description" text,
	"status" text NOT NULL,
	"reason" text,
	"tx_hash" text,
	"request" jsonb,
	"response" jsonb,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wallet_keys" (
	"id" uuid PRIMARY KEY NOT NULL,
	"network" "network" NOT NULL,
	"owner_address" text NOT NULL,
	"kind" "key_kind" NOT NULL,
	"label" text NOT NULL,
	"key_id" text,
	"key_type" text NOT NULL,
	"public_key" text,
	"holder_address" text,
	"holder_name" text,
	"token" text NOT NULL,
	"spend_limit" bigint NOT NULL,
	"period" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"rules" jsonb,
	"sealed_key" text,
	"token_prefix" text,
	"token_hash" text,
	"invite_hash" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"authorized_tx_hash" text,
	"revoked_tx_hash" text,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "key_payments" ADD CONSTRAINT "key_payments_wallet_key_id_wallet_keys_id_fk" FOREIGN KEY ("wallet_key_id") REFERENCES "public"."wallet_keys"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "key_payments_key_idx" ON "key_payments" USING btree ("wallet_key_id","created_at");--> statement-breakpoint
CREATE INDEX "key_payments_status_idx" ON "key_payments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "wallet_keys_owner_idx" ON "wallet_keys" USING btree ("owner_address","network");--> statement-breakpoint
CREATE INDEX "wallet_keys_holder_idx" ON "wallet_keys" USING btree ("holder_address","network");--> statement-breakpoint
CREATE UNIQUE INDEX "wallet_keys_key_idx" ON "wallet_keys" USING btree ("key_id","network");--> statement-breakpoint
CREATE UNIQUE INDEX "wallet_keys_token_idx" ON "wallet_keys" USING btree ("token_prefix");--> statement-breakpoint
CREATE UNIQUE INDEX "wallet_keys_invite_idx" ON "wallet_keys" USING btree ("invite_hash");