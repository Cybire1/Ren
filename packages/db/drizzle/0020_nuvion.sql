CREATE TABLE "card_holders" (
	"id" uuid PRIMARY KEY NOT NULL,
	"wallet" text NOT NULL,
	"network" "network" NOT NULL,
	"provider" text DEFAULT 'nuvion' NOT NULL,
	"entity_id" text NOT NULL,
	"person_id" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"reason" text,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text,
	"phone" text,
	"account_id" text,
	"account_number" text,
	"counterparty_id" text,
	"payment_detail_id" text,
	"return_counterparty_id" text,
	"return_payment_detail_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "card_topups" (
	"id" uuid PRIMARY KEY NOT NULL,
	"wallet" text NOT NULL,
	"network" "network" NOT NULL,
	"amount" bigint NOT NULL,
	"fee" bigint DEFAULT 0 NOT NULL,
	"tx_hash" text,
	"reference" text NOT NULL,
	"status" text DEFAULT 'quoted' NOT NULL,
	"transfer_id" text,
	"problem" text,
	"expires_at" timestamp with time zone NOT NULL,
	"refund_tx_hash" text,
	"refund_block" bigint,
	"refund_tried_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "card_withdrawals" (
	"id" uuid PRIMARY KEY NOT NULL,
	"wallet" text NOT NULL,
	"network" "network" NOT NULL,
	"amount" bigint NOT NULL,
	"reference" text NOT NULL,
	"status" text DEFAULT 'pulling' NOT NULL,
	"transfer_id" text,
	"tx_hash" text,
	"pay_block" bigint,
	"pay_tried_at" timestamp with time zone,
	"problem" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dollar_cards" (
	"id" uuid PRIMARY KEY NOT NULL,
	"wallet" text NOT NULL,
	"network" "network" NOT NULL,
	"provider" text DEFAULT 'nuvion' NOT NULL,
	"provider_card_token" text NOT NULL,
	"last_four" text NOT NULL,
	"brand" text,
	"exp_month" text,
	"exp_year" text,
	"state" text DEFAULT 'open' NOT NULL,
	"daily_limit" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "money_access_requests" (
	"id" uuid PRIMARY KEY NOT NULL,
	"wallet" text NOT NULL,
	"network" "network" NOT NULL,
	"feature" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payout_recipients" (
	"id" uuid PRIMARY KEY NOT NULL,
	"wallet" text NOT NULL,
	"network" "network" NOT NULL,
	"corridor" text NOT NULL,
	"country" text NOT NULL,
	"currency" text NOT NULL,
	"holder_name" text NOT NULL,
	"label" text NOT NULL,
	"counterparty_id" text NOT NULL,
	"payment_detail_id" text NOT NULL,
	"entity_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payouts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"network" "network" NOT NULL,
	"wallet" text NOT NULL,
	"recipient_id" uuid NOT NULL,
	"amount" bigint NOT NULL,
	"fee" bigint DEFAULT 0 NOT NULL,
	"currency" text NOT NULL,
	"amount_to" bigint NOT NULL,
	"rate" text NOT NULL,
	"fx_quote_id" text,
	"status" text DEFAULT 'quoted' NOT NULL,
	"tx_hash" text,
	"transfer_id" text,
	"provider_fee" bigint,
	"entity_id" text,
	"funded_cents" bigint,
	"rest_returned_at" timestamp with time zone,
	"pulled_back_at" timestamp with time zone,
	"refund_tx_hash" text,
	"refund_block" bigint,
	"refund_tried_at" timestamp with time zone,
	"failure" text,
	"expires_at" timestamp with time zone NOT NULL,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "card_holders_wallet_idx" ON "card_holders" USING btree ("wallet","network");--> statement-breakpoint
CREATE UNIQUE INDEX "card_topups_tx_idx" ON "card_topups" USING btree ("tx_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "card_topups_reference_idx" ON "card_topups" USING btree ("reference");--> statement-breakpoint
CREATE INDEX "card_topups_wallet_idx" ON "card_topups" USING btree ("wallet","network","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "card_withdrawals_reference_idx" ON "card_withdrawals" USING btree ("reference");--> statement-breakpoint
CREATE INDEX "card_withdrawals_wallet_idx" ON "card_withdrawals" USING btree ("wallet","network","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "dollar_cards_token_idx" ON "dollar_cards" USING btree ("provider_card_token");--> statement-breakpoint
CREATE INDEX "dollar_cards_wallet_idx" ON "dollar_cards" USING btree ("wallet","network");--> statement-breakpoint
CREATE UNIQUE INDEX "money_access_requests_idx" ON "money_access_requests" USING btree ("wallet","network","feature");--> statement-breakpoint
CREATE INDEX "payout_recipients_wallet_idx" ON "payout_recipients" USING btree ("wallet","network","created_at");--> statement-breakpoint
CREATE INDEX "payouts_wallet_idx" ON "payouts" USING btree ("wallet","network","created_at");--> statement-breakpoint
CREATE INDEX "payouts_status_idx" ON "payouts" USING btree ("network","status");--> statement-breakpoint
CREATE UNIQUE INDEX "payouts_tx_idx" ON "payouts" USING btree ("tx_hash");