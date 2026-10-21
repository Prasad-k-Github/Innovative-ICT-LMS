CREATE TYPE "public"."medium" AS ENUM('SINHALA', 'ENGLISH');--> statement-breakpoint
DROP INDEX "lessons_grade_order_idx";--> statement-breakpoint
DROP INDEX "resources_grade_type_idx";--> statement-breakpoint
ALTER TABLE "lessons" ADD COLUMN "medium" "medium" NOT NULL;--> statement-breakpoint
ALTER TABLE "resources" ADD COLUMN "medium" "medium" NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "medium" "medium";--> statement-breakpoint
CREATE INDEX "lessons_grade_medium_order_idx" ON "lessons" USING btree ("grade","medium","order");--> statement-breakpoint
CREATE INDEX "resources_grade_medium_type_idx" ON "resources" USING btree ("grade","medium","type");