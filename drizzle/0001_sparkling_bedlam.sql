CREATE TABLE "webhook_subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"team" text NOT NULL,
	"url" text NOT NULL,
	"secret" text NOT NULL,
	"events" jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_deliveries" (
	"id" text PRIMARY KEY NOT NULL,
	"subscription_id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status_code" integer,
	"response_time_ms" integer,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "batches" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"team" text NOT NULL,
	"total_count" integer NOT NULL,
	"sent_count" integer DEFAULT 0 NOT NULL,
	"delivered_count" integer DEFAULT 0 NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'processing' NOT NULL,
	"metadata" jsonb,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "is_sandbox" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_webhook_subs_tenant_team" ON "webhook_subscriptions" USING btree ("tenant_id","team","active");--> statement-breakpoint
CREATE INDEX "idx_webhook_deliv_sub" ON "webhook_deliveries" USING btree ("subscription_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_batches_tenant_team_created" ON "batches" USING btree ("tenant_id","team","created_at");--> statement-breakpoint
CREATE INDEX "idx_batches_status_updated" ON "batches" USING btree ("status","updated_at");--> statement-breakpoint
CREATE INDEX "idx_messages_public_id_created" ON "messages" USING btree ("public_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_messages_team_created" ON "messages" USING btree ("team","created_at");--> statement-breakpoint
CREATE INDEX "idx_messages_state_scheduled" ON "messages" USING btree ("state","scheduled_at");--> statement-breakpoint
CREATE INDEX "idx_messages_sandbox" ON "messages" USING btree ("team","is_sandbox","created_at");--> statement-breakpoint
CREATE INDEX "idx_outbox_state_available" ON "outbox" USING btree ("state","available_at");--> statement-breakpoint
CREATE INDEX "idx_suppressions_hash" ON "suppressions" USING btree ("identifier_hash");--> statement-breakpoint
CREATE INDEX "idx_suppressions_team" ON "suppressions" USING btree ("team","identifier_hash");