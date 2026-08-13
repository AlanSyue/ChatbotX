"use server"

import { fbCommentAutomationService } from "@chatbotx.io/business"
import { ChatbotXException } from "@chatbotx.io/business/errors"
import { zodBigintAsString } from "@chatbotx.io/utils"
import { getTranslations } from "next-intl/server"
import { workspaceActionClient } from "@/lib/safe-action"
import { normalizePublicReply } from "../lib/public-reply"
import {
  type CreateFbCommentRequest,
  createFbCommentRequest,
  type UpdateFbCommentRequest,
  updateFbCommentRequest,
} from "../schema/action"

async function assertValidMergedInput(
  input: CreateFbCommentRequest,
): Promise<void> {
  const result = createFbCommentRequest.safeParse(input)

  if (!result.success) {
    const t = await getTranslations()
    throw new ChatbotXException(t("messages.unknownError"), "badRequest", 400)
  }
}

export const updateFbComment = async (
  ctx: { workspaceId: string; id: string },
  input: UpdateFbCommentRequest,
) => {
  const t = await getTranslations()
  const existing = await fbCommentAutomationService.findByIdForWorkspace({
    id: ctx.id,
    workspaceId: ctx.workspaceId,
  })
  if (!existing) {
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
    type: existing.type as CreateFbCommentRequest["type"],
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
  } satisfies CreateFbCommentRequest
  await assertValidMergedInput(merged)

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

export const updateFbCommentAction = workspaceActionClient
  .bindArgsSchemas([zodBigintAsString(), zodBigintAsString()])
  .inputSchema(updateFbCommentRequest)
  .action(
    async ({
      bindArgsParsedInputs: [workspaceId, id],
      parsedInput,
    }: {
      bindArgsParsedInputs: readonly [string, string]
      parsedInput: UpdateFbCommentRequest
    }) => {
      await updateFbComment({ workspaceId, id }, parsedInput)
    },
  )
