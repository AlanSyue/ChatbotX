import {
  storyReplyAutomationIncludeKeywordsSchema,
  storyReplyAutomationReplyAfterSchema,
  storyReplyAutomationReplySchema,
  storyReplyAutomationStoryTargetSchema,
} from "@chatbotx.io/database/partials"
import type { StoryReplyAutomationModel } from "@chatbotx.io/database/types"
import { getSortingStateParser } from "@chatbotx.io/ui/lib/parsers"
import { zodBigintAsString } from "@chatbotx.io/utils"
import {
  createSearchParamsCache,
  parseAsBoolean,
  parseAsInteger,
  parseAsString,
} from "nuqs/server"
import z from "zod"
import { parseAsBigInt } from "@/lib/nuqs"
import { basePaginationRequest } from "@/lib/pagination"
import { storyReplyAutomationResource } from "./resource"

export const listStoryReplyAutomationsRequest = basePaginationRequest.and(
  z.object({
    workspaceId: zodBigintAsString(),
    name: z.string().nullish(),
    folderId: zodBigintAsString().nullish(),
    isActive: z.boolean().nullish(),
  }),
)
export type ListStoryReplyAutomationsRequest = z.infer<
  typeof listStoryReplyAutomationsRequest
>

export const listStoryReplyAutomationsSearchParamsCache =
  createSearchParamsCache({
    page: parseAsInteger.withDefault(1),
    perPage: parseAsInteger.withDefault(10),
    name: parseAsString.withDefault(""),
    isActive: parseAsBoolean,
    folderId: parseAsBigInt,
    sort: getSortingStateParser<StoryReplyAutomationModel>().withDefault([
      { id: "createdAt", desc: true },
    ]),
  })

export const listStoryReplyAutomationsResponse = z.object({
  data: z.array(storyReplyAutomationResource),
  pageCount: z.number(),
})
export type ListStoryReplyAutomationsResponse = z.infer<
  typeof listStoryReplyAutomationsResponse
>

export const createStoryReplyAutomationRequest = z.object({
  name: z.string().trim().min(1).max(255),
  type: z.enum(["messenger", "instagram"]),
  folderId: zodBigintAsString().nullish(),
  isActive: z.boolean().optional(),
  startTime: z.string().nullable().optional(),
  endTime: z.string().nullable().optional(),
  storyTarget: storyReplyAutomationStoryTargetSchema,
  includeKeywords: storyReplyAutomationIncludeKeywordsSchema,
  excludeKeywords: z.array(z.string()),
  reply: storyReplyAutomationReplySchema,
  replyAfter: storyReplyAutomationReplyAfterSchema,
})
export type CreateStoryReplyAutomationRequest = z.infer<
  typeof createStoryReplyAutomationRequest
>

export const updateStoryReplyAutomationRequest =
  createStoryReplyAutomationRequest.partial()
export type UpdateStoryReplyAutomationRequest = z.infer<
  typeof updateStoryReplyAutomationRequest
>
