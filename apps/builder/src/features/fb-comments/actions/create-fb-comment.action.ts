"use server"

import { fbCommentAutomationService } from "@chatbotx.io/business"
import { ChatbotXException } from "@chatbotx.io/business/errors"
import { createId } from "@chatbotx.io/utils"
import { getTranslations } from "next-intl/server"
import {
  type WorkspaceIdRequestParams,
  workspaceIdrequestParams,
} from "@/features/common/schemas"
import { workspaceActionClient } from "@/lib/safe-action"
import { normalizePublicReply } from "../lib/public-reply"
import {
  type CreateFbCommentRequest,
  createFbCommentRequest,
} from "../schema/action"

async function assertValidCreateInput(
  input: CreateFbCommentRequest,
): Promise<void> {
  const result = createFbCommentRequest.safeParse(input)

  if (!result.success) {
    const t = await getTranslations()
    throw new ChatbotXException(t("messages.unknownError"), "badRequest", 400)
  }
}

export const createFbComment = async (
  workspaceId: string,
  input: CreateFbCommentRequest,
) => {
  const normalizedInput = {
    ...input,
    publicReply: normalizePublicReply(input.publicReply),
  } satisfies CreateFbCommentRequest
  await assertValidCreateInput(normalizedInput)

  const id = createId()

  const record = await fbCommentAutomationService.create({
    id,
    workspaceId,
    input: {
      ...normalizedInput,
    },
  })

  return record
}

export const createFbCommentAction = workspaceActionClient
  .bindArgsSchemas(workspaceIdrequestParams)
  .inputSchema(createFbCommentRequest)
  .action(
    async ({
      bindArgsParsedInputs: [workspaceId],
      parsedInput,
    }: {
      bindArgsParsedInputs: WorkspaceIdRequestParams
      parsedInput: CreateFbCommentRequest
    }) => {
      const record = await createFbComment(workspaceId, parsedInput)
      return { id: record.id }
    },
  )
