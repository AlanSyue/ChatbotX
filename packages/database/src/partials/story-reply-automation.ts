import { z } from "zod"

export const storyReplyAutomationTypes = z.enum(["messenger", "instagram"])
export type StoryReplyAutomationType = z.infer<typeof storyReplyAutomationTypes>

export const storyReplyAutomationStoryTargetSchema = z.object({
  type: z.enum(["specific", "all"]),
  value: z.array(z.string()),
})
export type StoryReplyAutomationStoryTarget = z.infer<
  typeof storyReplyAutomationStoryTargetSchema
>

export const storyReplyAutomationIncludeKeywordsSchema = z.object({
  type: z.enum(["all", "equal", "contain"]),
  value: z.array(z.string()),
})
export type StoryReplyAutomationIncludeKeywords = z.infer<
  typeof storyReplyAutomationIncludeKeywordsSchema
>

export const storyReplyAutomationReplySchema = z.object({
  type: z.enum(["AIAgent", "text", "flow", "none"]),
  value: z.string().nullable(),
})
export type StoryReplyAutomationReply = z.infer<
  typeof storyReplyAutomationReplySchema
>

export const storyReplyAutomationReplyAfterSchema = z.object({
  type: z.enum([
    "immediately",
    "seconds",
    "minutes",
    "hours",
    "randomWithin3Minutes",
    "randomWithin5Minutes",
    "randomWithin10Minutes",
    "randomWithin20Minutes",
    "randomWithin30Minutes",
    "randomWithin60Minutes",
  ]),
  value: z.coerce.number(),
})
export type StoryReplyAutomationReplyAfter = z.infer<
  typeof storyReplyAutomationReplyAfterSchema
>
