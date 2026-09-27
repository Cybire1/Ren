CREATE TABLE "test_dollar_claims" (
	"address" text PRIMARY KEY NOT NULL,
	"claimed_at" timestamp with time zone NOT NULL,
	"tx_hash" text
);
