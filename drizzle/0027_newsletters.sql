CREATE TABLE "newsletters" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"body" text NOT NULL,
	"grade" integer,
	"medium" "medium",
	"institute_id" text,
	"published" boolean DEFAULT false NOT NULL,
	"published_at" timestamp,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "newsletters" ADD CONSTRAINT "newsletters_institute_id_institutes_id_fk" FOREIGN KEY ("institute_id") REFERENCES "public"."institutes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "newsletters_pub_idx" ON "newsletters" USING btree ("published","published_at");