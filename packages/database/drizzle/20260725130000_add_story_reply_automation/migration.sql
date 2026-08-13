CREATE TYPE "storyReplyAutomationType" AS ENUM('messenger', 'instagram');--> statement-breakpoint
CREATE TABLE "StoryReplyAutomation" (
	"id" bigint PRIMARY KEY,
	"createdAt" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"workspaceId" bigint NOT NULL,
	"folderId" bigint,
	"type" "storyReplyAutomationType" DEFAULT 'messenger'::"storyReplyAutomationType" NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"startTime" text,
	"endTime" text,
	"repliesCount" integer DEFAULT 0 NOT NULL,
	"storyTarget" jsonb DEFAULT '{"type":"all","value":[]}' NOT NULL,
	"includeKeywords" jsonb DEFAULT '{"type":"all","value":[]}' NOT NULL,
	"excludeKeywords" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"reply" jsonb DEFAULT '{"type":"text","value":""}' NOT NULL,
	"replyAfter" jsonb DEFAULT '{"type":"immediately","value":0}' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "StoryReplyAutomationDispatch" (
	"id" bigint PRIMARY KEY,
	"createdAt" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"automationId" bigint NOT NULL,
	"storyReplyMessageId" text NOT NULL,
	"workspaceId" bigint NOT NULL,
	"scheduledAt" timestamp(6) with time zone
);
--> statement-breakpoint
CREATE INDEX "StoryReplyAutomation_workspaceId_idx" ON "StoryReplyAutomation" ("workspaceId");--> statement-breakpoint
CREATE INDEX "StoryReplyAutomation_folderId_idx" ON "StoryReplyAutomation" ("folderId");--> statement-breakpoint
CREATE UNIQUE INDEX "StoryReplyAutomationDispatch_automationId_storyReplyMessageId_key" ON "StoryReplyAutomationDispatch" ("automationId","storyReplyMessageId");--> statement-breakpoint
CREATE INDEX "StoryReplyAutomationDispatch_workspaceId_idx" ON "StoryReplyAutomationDispatch" ("workspaceId");--> statement-breakpoint
ALTER TABLE "StoryReplyAutomation" ADD CONSTRAINT "StoryReplyAutomation_workspaceId_Workspace_id_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "StoryReplyAutomation" ADD CONSTRAINT "StoryReplyAutomation_folderId_Folder_id_fkey" FOREIGN KEY ("folderId") REFERENCES "Folder"("id") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "StoryReplyAutomationDispatch" ADD CONSTRAINT "StoryReplyAutomationDispatch_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "StoryReplyAutomation"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "StoryReplyAutomationDispatch" ADD CONSTRAINT "StoryReplyAutomationDispatch_workspaceId_Workspace_id_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE;
