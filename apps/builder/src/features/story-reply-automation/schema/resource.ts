import {
  storyReplyAutomationIncludeKeywordsSchema,
  storyReplyAutomationReplyAfterSchema,
  storyReplyAutomationReplySchema,
  storyReplyAutomationStoryTargetSchema,
} from "@chatbotx.io/database/partials"
import {
  createSelectSchema,
  storyReplyAutomationModel,
} from "@chatbotx.io/database/schema"
import z from "zod"

export const storyReplyAutomationResource = createSelectSchema(
  storyReplyAutomationModel,
  {
    id: z.string(),
    workspaceId: z.string(),
    folderId: z.string().nullish(),
    storyTarget: storyReplyAutomationStoryTargetSchema,
    includeKeywords: storyReplyAutomationIncludeKeywordsSchema,
    excludeKeywords: z.array(z.string()),
    reply: storyReplyAutomationReplySchema,
    replyAfter: storyReplyAutomationReplyAfterSchema,
  },
)
export type StoryReplyAutomationResource = z.infer<
  typeof storyReplyAutomationResource
>
