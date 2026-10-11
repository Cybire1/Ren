CREATE TABLE "ussd_pockets" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_address" text NOT NULL,
	"phone" text NOT NULL,
	"pocket_address" text NOT NULL,
	"sealed_key" text NOT NULL,
	"pin_hash" text NOT NULL,
	"cap" bigint NOT NULL,
	"failed_pins" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"last_signed_at" bigint DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"code_hash" text,
	"code_expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ussd_spends" (
	"id" uuid PRIMARY KEY NOT NULL,
	"pocket_id" uuid NOT NULL,
	"session_id" text NOT NULL,
	"kind" text NOT NULL,
	"to_address" text NOT NULL,
	"to_label" text NOT NULL,
	"amount" bigint NOT NULL,
	"intent_id" uuid,
	"status" text DEFAULT 'pending' NOT NULL,
	"tx_hash" text,
	"reference" text NOT NULL,
	"failure" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ussd_till_codes" (
	"code" text PRIMARY KEY NOT NULL,
	"intent_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ussd_spends" ADD CONSTRAINT "ussd_spends_pocket_id_ussd_pockets_id_fk" FOREIGN KEY ("pocket_id") REFERENCES "public"."ussd_pockets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ussd_spends" ADD CONSTRAINT "ussd_spends_intent_id_payment_intents_id_fk" FOREIGN KEY ("intent_id") REFERENCES "public"."payment_intents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ussd_till_codes" ADD CONSTRAINT "ussd_till_codes_intent_id_payment_intents_id_fk" FOREIGN KEY ("intent_id") REFERENCES "public"."payment_intents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ussd_pockets_owner_idx" ON "ussd_pockets" USING btree ("owner_address");--> statement-breakpoint
CREATE INDEX "ussd_pockets_phone_idx" ON "ussd_pockets" USING btree ("phone");--> statement-breakpoint
CREATE UNIQUE INDEX "ussd_pockets_address_idx" ON "ussd_pockets" USING btree ("pocket_address");--> statement-breakpoint
CREATE UNIQUE INDEX "ussd_spends_session_idx" ON "ussd_spends" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "ussd_spends_pocket_idx" ON "ussd_spends" USING btree ("pocket_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ussd_till_codes_intent_idx" ON "ussd_till_codes" USING btree ("intent_id");