CREATE TABLE "card_taps" (
	"id" uuid PRIMARY KEY NOT NULL,
	"card_address" text NOT NULL,
	"intent_id" uuid NOT NULL,
	"terminal_id" uuid,
	"amount" bigint NOT NULL,
	"pay_to" text NOT NULL,
	"memo" text NOT NULL,
	"deadline" bigint NOT NULL,
	"pin_required" boolean NOT NULL,
	"status" text DEFAULT 'prepared' NOT NULL,
	"tx_hash" text,
	"failure" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kova_cards" (
	"address" text PRIMARY KEY NOT NULL,
	"network" "network" NOT NULL,
	"holder_address" text NOT NULL,
	"label" text DEFAULT 'Kova Card' NOT NULL,
	"last_four" text NOT NULL,
	"pin_hash" text NOT NULL,
	"failed_pins" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"no_pin_limit" bigint NOT NULL,
	"frozen" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"link_tx_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "card_taps" ADD CONSTRAINT "card_taps_card_address_kova_cards_address_fk" FOREIGN KEY ("card_address") REFERENCES "public"."kova_cards"("address") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_taps" ADD CONSTRAINT "card_taps_intent_id_payment_intents_id_fk" FOREIGN KEY ("intent_id") REFERENCES "public"."payment_intents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_taps" ADD CONSTRAINT "card_taps_terminal_id_terminals_id_fk" FOREIGN KEY ("terminal_id") REFERENCES "public"."terminals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "card_taps_card_idx" ON "card_taps" USING btree ("card_address","created_at");--> statement-breakpoint
CREATE INDEX "card_taps_intent_idx" ON "card_taps" USING btree ("intent_id");--> statement-breakpoint
CREATE INDEX "kova_cards_holder_idx" ON "kova_cards" USING btree ("holder_address");