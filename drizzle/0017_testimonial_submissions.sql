DROP INDEX "testimonials_pub_idx";--> statement-breakpoint
ALTER TABLE "testimonials" ADD COLUMN "status" text DEFAULT 'APPROVED' NOT NULL;--> statement-breakpoint
ALTER TABLE "testimonials" ADD COLUMN "submitted_by" text;--> statement-breakpoint
ALTER TABLE "testimonials" ADD CONSTRAINT "testimonials_submitted_by_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "testimonials_student_idx" ON "testimonials" USING btree ("submitted_by");--> statement-breakpoint
CREATE INDEX "testimonials_pub_idx" ON "testimonials" USING btree ("published","status","created_at");