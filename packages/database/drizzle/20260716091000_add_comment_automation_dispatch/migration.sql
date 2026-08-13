CREATE TABLE "FBCommentAutomationDispatch" (
	"id" bigint PRIMARY KEY,
	"createdAt" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"automationId" bigint NOT NULL,
	"commentId" text NOT NULL,
	"workspaceId" bigint NOT NULL,
	"publicMessageId" bigint,
	"publicMessageCreatedAt" timestamp(6) with time zone,
	"scheduledAt" timestamp(6) with time zone,
	"privateReplySentAt" timestamp(6) with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX "FBCommentAutomationDispatch_automationId_commentId_key" ON "FBCommentAutomationDispatch" ("automationId","commentId");
--> statement-breakpoint
CREATE INDEX "FBCommentAutomationDispatch_workspaceId_idx" ON "FBCommentAutomationDispatch" ("workspaceId");
--> statement-breakpoint
ALTER TABLE "FBCommentAutomationDispatch" ADD CONSTRAINT "FBCommentAutomationDispatch_automationId_FBCommentAutomation_id_fkey" FOREIGN KEY ("automationId") REFERENCES "FBCommentAutomation"("id") ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE "FBCommentAutomationDispatch" ADD CONSTRAINT "FBCommentAutomationDispatch_workspaceId_Workspace_id_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE;
