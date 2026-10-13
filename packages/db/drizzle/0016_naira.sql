CREATE TABLE "cash_outs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"network" "network" NOT NULL,
	"wallet_address" text NOT NULL,
	"amount" bigint NOT NULL,
	"naira" bigint NOT NULL,
	"rate" text NOT NULL,
	"fee" bigint NOT NULL,
	"bank_code" text NOT NULL,
	"bank_name" text NOT NULL,
	"account_number" text NOT NULL,
	"account_name" text NOT NULL,
	"recipient_code" text NOT NULL,
	"status" text DEFAULT 'quoted' NOT NULL,
	"tx_hash" text,
	"transfer_code" text,
	"failure" text,
	"expires_at" timestamp with time zone NOT NULL,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "naira_pay_ins" (
	"id" uuid PRIMARY KEY NOT NULL,
	"intent_id" uuid NOT NULL,
	"reference" text NOT NULL,
	"naira" bigint NOT NULL,
	"rate" text NOT NULL,
	"email" text NOT NULL,
	"status" text DEFAULT 'initialized' NOT NULL,
	"tx_hash" text,
	"failure" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "naira_pay_ins" ADD CONSTRAINT "naira_pay_ins_intent_id_payment_intents_id_fk" FOREIGN KEY ("intent_id") REFERENCES "public"."payment_intents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cash_outs_wallet_idx" ON "cash_outs" USING btree ("wallet_address","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "cash_outs_tx_idx" ON "cash_outs" USING btree ("tx_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "naira_pay_ins_reference_idx" ON "naira_pay_ins" USING btree ("reference");--> statement-breakpoint
CREATE INDEX "naira_pay_ins_intent_idx" ON "naira_pay_ins" USING btree ("intent_id");