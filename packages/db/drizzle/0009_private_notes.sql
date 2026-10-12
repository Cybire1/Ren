CREATE TABLE "note_keys" (
	"address" text PRIMARY KEY NOT NULL,
	"public_key" text NOT NULL,
	"signature" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_notes" (
	"tx_hash" text PRIMARY KEY NOT NULL,
	"from_address" text NOT NULL,
	"to_address" text NOT NULL,
	"auth_nonce" text NOT NULL,
	"sealed" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
