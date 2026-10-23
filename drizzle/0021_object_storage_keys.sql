ALTER TABLE "agent_attachments" ALTER COLUMN "data" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "institutes" ALTER COLUMN "code" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "submission_files" ALTER COLUMN "data" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "user_avatars" ALTER COLUMN "data" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_attachments" ADD COLUMN "storage_key" text;--> statement-breakpoint
ALTER TABLE "submission_files" ADD COLUMN "storage_key" text;--> statement-breakpoint
ALTER TABLE "user_avatars" ADD COLUMN "storage_key" text;