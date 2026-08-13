"use server"

import { storyReplyAutomationService } from "@chatbotx.io/business"
import { zodBigintAsString } from "@chatbotx.io/utils"
import { workspaceActionClient } from "@/lib/safe-action"

export const deleteStoryReplyAutomation = async (ctx: {
  workspaceId: string
  id: string
}) => {
  await storyReplyAutomationService.delete(ctx)
}

export const deleteStoryReplyAutomationAction = workspaceActionClient
  .bindArgsSchemas([zodBigintAsString(), zodBigintAsString()])
  .action(async (props) => {
    const {
      bindArgsParsedInputs: [workspaceId, id],
    } = props

    await deleteStoryReplyAutomation({ workspaceId, id })
  })
