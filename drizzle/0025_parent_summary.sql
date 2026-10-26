ALTER TABLE "users" ADD COLUMN "parent_email" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "parent_phone" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "parent_opt_in_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "parent_summary_sent_at" timestamp;