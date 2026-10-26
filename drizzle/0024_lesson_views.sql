CREATE TABLE "lesson_views" (
	"user_id" text NOT NULL,
	"lesson_id" text NOT NULL,
	"first_viewed_at" timestamp DEFAULT now() NOT NULL,
	"last_viewed_at" timestamp DEFAULT now() NOT NULL,
	"views" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "lesson_views_user_id_lesson_id_pk" PRIMARY KEY("user_id","lesson_id")
);
--> statement-breakpoint
ALTER TABLE "lesson_views" ADD CONSTRAINT "lesson_views_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_views" ADD CONSTRAINT "lesson_views_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lesson_views_lesson_idx" ON "lesson_views" USING btree ("lesson_id");--> statement-breakpoint
CREATE INDEX "lesson_views_last_idx" ON "lesson_views" USING btree ("last_viewed_at");