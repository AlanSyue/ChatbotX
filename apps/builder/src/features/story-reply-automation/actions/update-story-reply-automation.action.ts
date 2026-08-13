"use server"

import { storyReplyAutomationService } from "@chatbotx.io/business"
import { zodBigintAsString } from "@chatbotx.io/utils"
import { workspaceActionClient } from "@/lib/safe-action"
import {
  type UpdateStoryReplyAutomationRequest,
  updateStoryReplyAutomationRequest,
} from "../schema/action"

export const updateStoryReplyAutomation = async (
  ctx: { workspaceId: string; id: string },
  input: UpdateStoryReplyAutomationRequest,
) => await storyReplyAutomationService.update(ctx, input)

export const updateStoryReplyAutomationAction = workspaceActionClient
  .bindArgsSchemas([zodBigintAsString(), zodBigintAsString()])
  .inputSchema(updateStoryReplyAutomationRequest)
  .action(
    async ({
      bindArgsParsedInputs: [workspaceId, id],
      parsedInput,
    }: {
      bindArgsParsedInputs: readonly [string, string]
      parsedInput: UpdateStoryReplyAutomationRequest
    }) => {
      await updateStoryReplyAutomation({ workspaceId, id }, parsedInput)
    },
  )
