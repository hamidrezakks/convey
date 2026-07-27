ALTER TABLE "suppressions" ALTER COLUMN "channel" SET DEFAULT 'ALL';--> statement-breakpoint
ALTER TABLE "suppressions" ALTER COLUMN "channel" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "outbox" ADD COLUMN "shard_id" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "suppressions" ADD COLUMN "tenant_id" text;--> statement-breakpoint
ALTER TABLE "suppressions" ADD COLUMN "recipient" text;--> statement-breakpoint
CREATE INDEX "outbox_shard_state_avail_idx" ON "outbox" USING btree ("shard_id","state","available_at");