ALTER TYPE "public"."role" ADD VALUE 'SUPER_ADMIN' BEFORE 'ADMIN';--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN "target_id" text;--> statement-breakpoint
CREATE INDEX "audit_logs_target_idx" ON "audit_logs" USING btree ("target_id");--> statement-breakpoint
CREATE INDEX "audit_logs_actor_idx" ON "audit_logs" USING btree ("actor_id");