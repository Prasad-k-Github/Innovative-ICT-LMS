ALTER TABLE "users" ADD COLUMN "parent_unsubscribed_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "must_change_password" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "temp_password_expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email_confirmed_at" timestamp;--> statement-breakpoint
-- පවතින ගිණුම්: Email එක දැනටමත් තහවුරු කර ඇති ලෙස සලකයි
UPDATE "users" SET "email_confirmed_at" = "email_verified" WHERE "email_verified" IS NOT NULL;
--> statement-breakpoint
-- කලින් එකඟත්වය නොමැති (හෝ unsubscribe කළ) දෙමාපිය Email වලට අලුත් නීතියෙන් Email නොයැවීමට
UPDATE "users" SET "parent_unsubscribed_at" = now() WHERE "parent_email" IS NOT NULL AND "parent_opt_in_at" IS NULL;
