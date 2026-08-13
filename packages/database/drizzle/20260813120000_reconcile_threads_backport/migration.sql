ALTER TYPE "fbCommentAutomationType" ADD VALUE IF NOT EXISTS 'threads';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "IntegrationThreads" (
	"id" bigint PRIMARY KEY NOT NULL,
	"createdAt" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"auth" jsonb NOT NULL,
	"threadsUserId" text NOT NULL,
	"username" text NOT NULL,
	"name" text NOT NULL,
	"workspaceId" bigint NOT NULL,
	"inboxId" bigint NOT NULL,
	CONSTRAINT "IntegrationThreads_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE cascade ON UPDATE cascade,
	CONSTRAINT "IntegrationThreads_inboxId_fkey" FOREIGN KEY ("inboxId") REFERENCES "public"."Inbox"("id") ON DELETE cascade ON UPDATE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "IntegrationThreads_workspaceId_idx" ON "IntegrationThreads" USING btree ("workspaceId");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "IntegrationThreads_inboxId_key" ON "IntegrationThreads" USING btree ("inboxId");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "IntegrationThreads_threadsUserId_key" ON "IntegrationThreads" USING btree ("threadsUserId");
--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_constraint
		WHERE conname = 'IntegrationThreads_workspaceId_fkey'
			AND conrelid = '"IntegrationThreads"'::regclass
	) THEN
		ALTER TABLE "IntegrationThreads"
		ADD CONSTRAINT "IntegrationThreads_workspaceId_fkey"
		FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id")
		ON DELETE cascade ON UPDATE cascade;
	END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_constraint
		WHERE conname = 'IntegrationThreads_inboxId_fkey'
			AND conrelid = '"IntegrationThreads"'::regclass
	) THEN
		ALTER TABLE "IntegrationThreads"
		ADD CONSTRAINT "IntegrationThreads_inboxId_fkey"
		FOREIGN KEY ("inboxId") REFERENCES "public"."Inbox"("id")
		ON DELETE cascade ON UPDATE cascade;
	END IF;
END $$;
