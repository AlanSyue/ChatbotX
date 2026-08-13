ALTER TABLE "AutomatedResponse" ADD COLUMN "texts" text[] DEFAULT '{}'::text[] NOT NULL;
--> statement-breakpoint
UPDATE "AutomatedResponse"
SET "texts" = ARRAY["text"]
WHERE "text" IS NOT NULL;
