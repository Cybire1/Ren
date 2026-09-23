ALTER TABLE "api_keys" ADD COLUMN "terminal_id" uuid;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_terminal_id_terminals_id_fk" FOREIGN KEY ("terminal_id") REFERENCES "public"."terminals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- Device keys issued before keys were linked to their terminal can't be told apart from a
-- shop's own key, so retire them (testnet only); those phones pair again.
UPDATE "api_keys" SET "revoked_at" = now() WHERE "name" LIKE 'terminal: %' AND "terminal_id" IS NULL AND "revoked_at" IS NULL;--> statement-breakpoint
UPDATE "terminals" SET "status" = 'disabled' WHERE "status" = 'active' AND NOT EXISTS (SELECT 1 FROM "api_keys" k WHERE k."terminal_id" = "terminals"."id");
