import { zodBigintAsString } from "@chatbotx.io/utils"
import { z } from "zod"

export const responseModes = z.enum(["flowId", "text"])
export type ResponseMode = z.infer<typeof responseModes>

const responseText = z.object({
  value: z.string().trim().min(1),
})

export const createAutomatedResponseRequest = z
  .object({
    folderId: zodBigintAsString().nullish(),
    keywords: z
      .array(
        z.object({
          value: z.string().min(1).max(255),
        }),
      )
      .min(1),
    text: z.string().length(0).or(z.string().min(1)).nullish(),
    texts: z.array(responseText).optional(),
    flowId: z.string().length(0).or(zodBigintAsString()).nullish(),
  })
  .refine(
    (data) =>
      data.flowId?.length || data.text?.length || Boolean(data.texts?.length),
    {
      error: "You need to select a flow or fill in the text.",
      path: ["flowId"],
    },
  )
export type CreateAutomatedResponseRequest = z.infer<
  typeof createAutomatedResponseRequest
>

export const updateAutomatedResponseRequest = createAutomatedResponseRequest
export type UpdateAutomatedResponseRequest = z.infer<
  typeof updateAutomatedResponseRequest
>

export const normalizeAutomatedResponseUpdate = (
  input: UpdateAutomatedResponseRequest,
): UpdateAutomatedResponseRequest => {
  if (input.texts?.length) {
    return {
      ...input,
      flowId: null,
      text: input.texts[0]?.value,
    }
  }
  if (input.text?.length) {
    return {
      ...input,
      flowId: null,
      texts: [{ value: input.text }],
    }
  }
  if (input.flowId) {
    return {
      ...input,
      text: null,
      texts: [],
    }
  }
  return input
}
