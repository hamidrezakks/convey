CREATE TABLE "tenants" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenants_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" text NOT NULL,
	"public_id" text NOT NULL,
	"user_id" text NOT NULL,
	"team" text NOT NULL,
	"category" text NOT NULL,
	"country" varchar(2) NOT NULL,
	"campaign_id" text,
	"state" text DEFAULT 'accepted' NOT NULL,
	"priority" text DEFAULT 'normal' NOT NULL,
	"recipients" jsonb NOT NULL,
	"channels" jsonb NOT NULL,
	"fallback" jsonb,
	"metadata" jsonb,
	"scheduled_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "messages_id_created_at_pk" PRIMARY KEY("id","created_at")
);
--> statement-breakpoint
CREATE TABLE "message_attempts" (
	"id" text NOT NULL,
	"message_id" text NOT NULL,
	"channel" text NOT NULL,
	"provider_id" text NOT NULL,
	"recipient_index" integer DEFAULT 0 NOT NULL,
	"attempt_no" integer NOT NULL,
	"origin" text NOT NULL,
	"state" text NOT NULL,
	"provider_message_id" text,
	"error_category" text,
	"error_code" text,
	"error_message" text,
	"provider_metadata" jsonb,
	"queued_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"provider_accepted_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"opened_at" timestamp with time zone,
	"read_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"latency_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "message_attempts_id_created_at_pk" PRIMARY KEY("id","created_at")
);
--> statement-breakpoint
CREATE TABLE "message_events" (
	"id" text NOT NULL,
	"message_id" text NOT NULL,
	"attempt_id" text,
	"channel" text,
	"provider_id" text,
	"type" text NOT NULL,
	"source" text NOT NULL,
	"metadata" jsonb,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "message_events_id_occurred_at_pk" PRIMARY KEY("id","occurred_at")
);
--> statement-breakpoint
CREATE TABLE "outbox" (
	"id" text PRIMARY KEY NOT NULL,
	"message_id" text NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"state" text DEFAULT 'pending' NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"locked_at" timestamp with time zone,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" text PRIMARY KEY NOT NULL,
	"external_id" text,
	"team" text NOT NULL,
	"name" text NOT NULL,
	"state" text DEFAULT 'active' NOT NULL,
	"metadata" jsonb,
	"paused_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provider_routes" (
	"id" text PRIMARY KEY NOT NULL,
	"team" text NOT NULL,
	"category" text NOT NULL,
	"country" text NOT NULL,
	"channel" text NOT NULL,
	"primary_provider_id" text NOT NULL,
	"secondary_provider_id" text,
	"priority" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "providers" (
	"id" text PRIMARY KEY NOT NULL,
	"channel" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"credentials" jsonb NOT NULL,
	"config" jsonb,
	"priority" integer DEFAULT 1 NOT NULL,
	"rate_limit_per_sec" integer DEFAULT 100,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suppressions" (
	"id" text PRIMARY KEY NOT NULL,
	"target_type" text NOT NULL,
	"identifier_type" text NOT NULL,
	"identifier_hash" text NOT NULL,
	"team" text NOT NULL,
	"category" text,
	"country" text,
	"channel" text,
	"reason" text NOT NULL,
	"starts_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ends_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "budget_ledger" (
	"id" text NOT NULL,
	"message_id" text NOT NULL,
	"team" text NOT NULL,
	"amount_usd" numeric(12, 4) NOT NULL,
	"channel" text NOT NULL,
	"provider_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "budget_ledger_id_created_at_pk" PRIMARY KEY("id","created_at")
);
--> statement-breakpoint
CREATE TABLE "budget_policies" (
	"id" text PRIMARY KEY NOT NULL,
	"team" text NOT NULL,
	"monthly_budget_usd" numeric(12, 4) NOT NULL,
	"hard_stop" text DEFAULT 'true' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "budget_usage" (
	"id" text PRIMARY KEY NOT NULL,
	"policy_id" text NOT NULL,
	"month" text NOT NULL,
	"used_usd" numeric(12, 4) DEFAULT '0.0000' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limit_policies" (
	"id" text PRIMARY KEY NOT NULL,
	"team" text NOT NULL,
	"category" text,
	"country" text,
	"channel" text,
	"window_seconds" integer DEFAULT 60 NOT NULL,
	"max_requests" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"team" text NOT NULL,
	"key_hash" text NOT NULL,
	"name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "api_keys_key_hash_unique" UNIQUE("key_hash")
);
--> statement-breakpoint
CREATE TABLE "report_hourly" (
	"id" text PRIMARY KEY NOT NULL,
	"team" text NOT NULL,
	"category" text NOT NULL,
	"country" text NOT NULL,
	"channel" text NOT NULL,
	"hour" timestamp with time zone NOT NULL,
	"sent_count" integer DEFAULT 0 NOT NULL,
	"delivered_count" integer DEFAULT 0 NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"opened_count" integer DEFAULT 0 NOT NULL,
	"read_count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_attempts_provider_msg" ON "message_attempts" USING btree ("provider_id","provider_message_id");