CREATE TYPE "public"."lesson_kind" AS ENUM('LESSON', 'TUTE');--> statement-breakpoint
DROP INDEX "lessons_grade_medium_title_uq";--> statement-breakpoint
ALTER TABLE "lessons" ADD COLUMN "kind" "lesson_kind" DEFAULT 'LESSON' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "lessons_grade_medium_kind_title_uq" ON "lessons" USING btree ("grade","medium","kind","title");