CREATE TABLE "class_links" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"url" text NOT NULL,
	"grade" integer NOT NULL,
	"medium" "medium" NOT NULL,
	"institute_id" text,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "class_links" ADD CONSTRAINT "class_links_institute_id_institutes_id_fk" FOREIGN KEY ("institute_id") REFERENCES "public"."institutes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "class_links_target_idx" ON "class_links" USING btree ("grade","medium","expires_at");