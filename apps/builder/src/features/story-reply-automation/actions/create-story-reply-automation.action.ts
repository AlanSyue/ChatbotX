"use server"

import { storyReplyAutomationService } from "@chatbotx.io/business"
import {
  type WorkspaceIdRequestParams,
  workspaceIdrequestParams,
} from "@/features/common/schemas"
import { workspaceActionClient } from "@/lib/safe-action"
import {
  type CreateStoryReplyAutomationRequest,
  createStoryReplyAutomationRequest,
} from "../schema/action"

export const createStoryReplyAutomation = async (
  workspaceId: string,
  input: CreateStoryReplyAutomationRequest,
) => await storyReplyAutomationService.create(workspaceId, input)

export const createStoryReplyAutomationAction = workspaceActionClient
  .bindArgsSchemas(workspaceIdrequestParams)
  .inputSchema(createStoryReplyAutomationRequest)
  .action(
    async ({
      bindArgsParsedInputs: [workspaceId],
      parsedInput,
    }: {
      bindArgsParsedInputs: WorkspaceIdRequestParams
      parsedInput: CreateStoryReplyAutomationRequest
    }) => {
      const record = await createStoryReplyAutomation(workspaceId, parsedInput)
      return { id: record.id }
    },
  )
