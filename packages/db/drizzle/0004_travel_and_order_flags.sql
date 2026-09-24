CREATE TYPE "public"."trip_kind" AS ENUM('flight', 'stay');--> statement-breakpoint
CREATE TYPE "public"."trip_status" AS ENUM('awaiting_payment', 'booking', 'booked', 'failed', 'expired', 'canceled');--> statement-breakpoint
CREATE TABLE "trip_shares" (
	"id" uuid PRIMARY KEY NOT NULL,
	"trip_id" uuid NOT NULL,
	"intent_id" uuid NOT NULL,
	"label" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trips" (
	"id" uuid PRIMARY KEY NOT NULL,
	"token_hash" text NOT NULL,
	"kind" "trip_kind" NOT NULL,
	"status" "trip_status" DEFAULT 'awaiting_payment' NOT NULL,
	"merchant_id" uuid NOT NULL,
	"summary" jsonb NOT NULL,
	"fare_amount" text NOT NULL,
	"fare_currency" text NOT NULL,
	"amount" bigint NOT NULL,
	"offer_id" text NOT NULL,
	"quote_id" text,
	"supplier_order_id" text,
	"booking_reference" text,
	"travellers" jsonb NOT NULL,
	"services" jsonb,
	"contact" jsonb,
	"pay_by" timestamp with time zone NOT NULL,
	"failure" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "flags" jsonb;--> statement-breakpoint
ALTER TABLE "trip_shares" ADD CONSTRAINT "trip_shares_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_shares" ADD CONSTRAINT "trip_shares_intent_id_payment_intents_id_fk" FOREIGN KEY ("intent_id") REFERENCES "public"."payment_intents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "trip_shares_intent_idx" ON "trip_shares" USING btree ("intent_id");--> statement-breakpoint
CREATE INDEX "trip_shares_trip_idx" ON "trip_shares" USING btree ("trip_id");--> statement-breakpoint
CREATE INDEX "trips_status_idx" ON "trips" USING btree ("status");--> statement-breakpoint
CREATE INDEX "trips_pay_by_idx" ON "trips" USING btree ("pay_by");