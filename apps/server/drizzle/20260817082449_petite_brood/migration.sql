CREATE TABLE "audit_logs" (
	"id" varchar(64) PRIMARY KEY,
	"tenant_id" varchar(64) NOT NULL,
	"team" varchar(64) NOT NULL,
	"actor_id" varchar(64) NOT NULL,
	"actor_role" varchar(32) NOT NULL,
	"action" varchar(64) NOT NULL,
	"resource_type" varchar(64) NOT NULL,
	"resource_id" varchar(64) NOT NULL,
	"details" jsonb,
	"prev_hash" varchar(64),
	"hash" varchar(64) NOT NULL,
	"ip_address" varchar(45),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "providers" ADD COLUMN "display_name" text;--> statement-breakpoint
ALTER TABLE "providers" ADD COLUMN "is_primary" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "providers" ADD COLUMN "weight" integer DEFAULT 100 NOT NULL;--> statement-breakpoint
ALTER TABLE "providers" ADD COLUMN "fallback_provider_id" text;--> statement-breakpoint
CREATE INDEX "idx_attempts_msg_created" ON "message_attempts" ("message_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_events_msg_occurred" ON "message_events" ("message_id","occurred_at");--> statement-breakpoint
CREATE INDEX "idx_messages_state_created" ON "messages" ("state","created_at");--> statement-breakpoint
CREATE INDEX "idx_outbox_state_processed" ON "outbox" ("state","processed_at");