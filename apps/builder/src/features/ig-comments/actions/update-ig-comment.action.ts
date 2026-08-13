"use server"

import { fbCommentAutomationService } from "@chatbotx.io/business"
import { ChatbotXException } from "@chatbotx.io/business/errors"
import { zodBigintAsString } from "@chatbotx.io/utils"
import { getTranslations } from "next-intl/server"
import { workspaceActionClient } from "@/lib/safe-action"
import { normalizePublicReply } from "../../fb-comments/lib/public-reply"
import {
  type CreateIgCommentRequest,
  createIgCommentRequest,
  igCommentVariants,
  type UpdateIgCommentRequest,
  updateIgCommentRequest,
} from "../schema/action"

export const updateIgComment = async (
  ctx: { workspaceId: string; id: string },
  input: UpdateIgCommentRequest,
) => {
  const t = await getTranslations()
  const existing = await fbCommentAutomationService.findByIdForWorkspace({
    id: ctx.id,
    workspaceId: ctx.workspaceId,
  })

  if (
    !(
      existing &&
      igCommentVariants.options.includes(
        existing.type as (typeof igCommentVariants.options)[number],
      )
    )
  ) {
    throw new ChatbotXException(
      t("channels.reconnect.errors.notFound"),
      "notFound",
      404,
    )
  }

  const normalizedInput = {
    ...input,
    ...(input.publicReply
      ? { publicReply: normalizePublicReply(input.publicReply) }
      : {}),
  }
  const merged = {
    name: existing.name,
    type: existing.type as CreateIgCommentRequest["type"],
    folderId: existing.folderId,
    post: existing.post,
    privateReply: existing.privateReply,
    publicReply: existing.publicReply,
    includeKeywords: existing.includeKeywords,
    excludeKeywords: existing.excludeKeywords,
    options: existing.options,
    hideComments: existing.hideComments,
    replyAfter: existing.replyAfter,
    ...normalizedInput,
  } satisfies CreateIgCommentRequest
  const validationResult = createIgCommentRequest.safeParse(merged)
  if (!validationResult.success) {
    throw new ChatbotXException(t("messages.unknownError"), "badRequest", 400)
  }

  const record = await fbCommentAutomationService.updateByIdForWorkspace({
    id: ctx.id,
    workspaceId: ctx.workspaceId,
    input: normalizedInput,
  })
  if (!record) {
    throw new ChatbotXException(
      t("channels.reconnect.errors.notFound"),
      "notFound",
      404,
    )
  }

  return record
}

export const updateIgCommentAction = workspaceActionClient
  .bindArgsSchemas([zodBigintAsString(), zodBigintAsString()])
  .inputSchema(updateIgCommentRequest)
  .action(
    async ({
      bindArgsParsedInputs: [workspaceId, id],
      parsedInput,
    }: {
      bindArgsParsedInputs: readonly [string, string]
      parsedInput: UpdateIgCommentRequest
    }) => {
      await updateIgComment({ workspaceId, id }, parsedInput)
    },
  )
