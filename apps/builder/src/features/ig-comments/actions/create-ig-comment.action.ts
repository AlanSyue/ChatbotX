"use server"

import { fbCommentAutomationService } from "@chatbotx.io/business"
import { createId } from "@chatbotx.io/utils"
import {
  type WorkspaceIdRequestParams,
  workspaceIdrequestParams,
} from "@/features/common/schemas"
import { workspaceActionClient } from "@/lib/safe-action"
import { normalizePublicReply } from "../../fb-comments/lib/public-reply"
import {
  type CreateIgCommentRequest,
  createIgCommentRequest,
} from "../schema/action"

export const createIgComment = async (
  workspaceId: string,
  input: CreateIgCommentRequest,
) => {
  const id = createId()
  const normalizedInput = {
    ...input,
    publicReply: normalizePublicReply(input.publicReply),
  }
  const record = await fbCommentAutomationService.create({
    id,
    workspaceId,
    input: normalizedInput,
  })

  return record
}

export const createIgCommentAction = workspaceActionClient
  .bindArgsSchemas(workspaceIdrequestParams)
  .inputSchema(createIgCommentRequest)
  .action(
    async ({
      bindArgsParsedInputs: [workspaceId],
      parsedInput,
    }: {
      bindArgsParsedInputs: WorkspaceIdRequestParams
      parsedInput: CreateIgCommentRequest
    }) => {
      const record = await createIgComment(workspaceId, parsedInput)
      return { id: record.id }
    },
  )
