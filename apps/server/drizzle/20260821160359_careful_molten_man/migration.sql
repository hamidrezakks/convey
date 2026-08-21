ALTER TABLE "budget_ledger" ADD COLUMN "currency" text DEFAULT 'USD' NOT NULL;--> statement-breakpoint
ALTER TABLE "budget_ledger" ADD COLUMN "exchange_rate" numeric(16,8) DEFAULT '1.00000000' NOT NULL;--> statement-breakpoint
ALTER TABLE "budget_ledger" ADD COLUMN "amount_in_policy_currency" numeric(12,4) DEFAULT '0.0000' NOT NULL;--> statement-breakpoint
ALTER TABLE "budget_policies" ADD COLUMN "currency" text DEFAULT 'USD' NOT NULL;--> statement-breakpoint
ALTER TABLE "budget_usage" ADD COLUMN "currency" text DEFAULT 'USD' NOT NULL;--> statement-breakpoint
ALTER TABLE "providers" ADD COLUMN "base_currency" text DEFAULT 'USD' NOT NULL;