CREATE TABLE "report_campaign_hourly" (
	"id" text PRIMARY KEY,
	"campaign_id" text NOT NULL,
	"team" text NOT NULL,
	"category" text NOT NULL,
	"channel" text NOT NULL,
	"hour" timestamp with time zone NOT NULL,
	"sent_count" integer DEFAULT 0 NOT NULL,
	"delivered_count" integer DEFAULT 0 NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"opened_count" integer DEFAULT 0 NOT NULL,
	"read_count" integer DEFAULT 0 NOT NULL,
	"cost_usd" numeric(12,4) DEFAULT '0.0000' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "tenant_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "status" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "report_hourly" ADD COLUMN "cost_usd" numeric(12,4) DEFAULT '0.0000' NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_report_camp_hourly_camp_hour" ON "report_campaign_hourly" ("campaign_id","hour");--> statement-breakpoint
CREATE INDEX "idx_report_camp_hourly_team_hour" ON "report_campaign_hourly" ("team","hour");--> statement-breakpoint
CREATE INDEX "idx_report_camp_hourly_hour" ON "report_campaign_hourly" ("hour");--> statement-breakpoint
CREATE INDEX "idx_report_hourly_team_hour" ON "report_hourly" ("team","hour");--> statement-breakpoint
CREATE INDEX "idx_report_hourly_category_hour" ON "report_hourly" ("category","hour");--> statement-breakpoint
CREATE INDEX "idx_report_hourly_hour" ON "report_hourly" ("hour");