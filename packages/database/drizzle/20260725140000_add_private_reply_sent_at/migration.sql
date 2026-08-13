ALTER TABLE "FBCommentAutomationDispatch" ADD COLUMN IF NOT EXISTS "privateReplySentAt" timestamp(6) with time zone;
--> statement-breakpoint
ALTER TABLE "StoryReplyAutomationDispatch" ADD COLUMN IF NOT EXISTS "privateReplySentAt" timestamp(6) with time zone;
