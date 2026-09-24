ALTER TYPE "public"."currency" ADD VALUE 'AUSD';--> statement-breakpoint
CREATE TABLE "transfers" (
	"id" uuid PRIMARY KEY NOT NULL,
	"network" "network" NOT NULL,
	"token_address" text NOT NULL,
	"from_address" text NOT NULL,
	"to_address" text NOT NULL,
	"amount" bigint NOT NULL,
	"tx_hash" text NOT NULL,
	"log_index" integer NOT NULL,
	"block_number" bigint NOT NULL,
	"nonce" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "transfers_tx_log_idx" ON "transfers" USING btree ("tx_hash","log_index");--> statement-breakpoint
CREATE INDEX "transfers_to_block_idx" ON "transfers" USING btree ("to_address","block_number");--> statement-breakpoint
CREATE INDEX "transfers_from_block_idx" ON "transfers" USING btree ("from_address","block_number");