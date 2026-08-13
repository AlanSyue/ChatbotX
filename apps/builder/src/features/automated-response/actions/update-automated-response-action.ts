"use server"

import { automatedResponseService, flowService } from "@chatbotx.io/business"
import { zodBigintAsString } from "@chatbotx.io/utils"
import { returnValidationErrors } from "next-safe-action"
import { workspaceActionClient } from "@/lib/safe-action"
import {
  normalizeAutomatedResponseUpdate,
  type UpdateAutomatedResponseRequest,
  updateAutomatedResponseRequest,
} from "../schema/action"

export const updateAutomatedResponseAction = workspaceActionClient
  .bindArgsSchemas([zodBigintAsString(), zodBigintAsString()])
  .inputSchema(updateAutomatedResponseRequest)
  .action(async (props) => {
    const {
      bindArgsParsedInputs: [workspaceId, id],
      parsedInput,
    } = props

    return await updateAutomatedResponse({ workspaceId, id }, parsedInput)
  })

export const updateAutomatedResponse = async (
  ctx: { workspaceId: string; id: string },
  parsedInput: UpdateAutomatedResponseRequest,
) => {
  const normalizedInput = normalizeAutomatedResponseUpdate(parsedInput)

  await automatedResponseService.findOrFail({
    workspaceId: ctx.workspaceId,
    id: ctx.id,
  })

  if (normalizedInput.flowId) {
    const exists = await flowService.exists(
      ctx.workspaceId,
      normalizedInput.flowId,
    )
    if (!exists) {
      return returnValidationErrors(updateAutomatedResponseRequest, {
        _errors: ["Validation Exception"],
        flowId: {
          _errors: ["Flow not found"],
        },
      })
    }
  }

  await automatedResponseService.update(ctx, normalizedInput)
}
