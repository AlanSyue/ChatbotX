"use server"

import { platformCredentialService } from "@chatbotx.io/business"
import {
  type ThreadsCredential,
  threadsCredentialUpdateSchema,
} from "@chatbotx.io/database/partials"
import { getTranslations } from "next-intl/server"
import { authActionClient } from "@/lib/safe-action"
import { credentialScopeSchema, resolveCredentialScopedUserId } from "../scope"

export const updateThreadsSettingAction = authActionClient
  .bindArgsSchemas([credentialScopeSchema])
  .inputSchema(threadsCredentialUpdateSchema)
  .action(async ({ ctx, bindArgsParsedInputs: [scope], parsedInput }) => {
    const scopedUserId = resolveCredentialScopedUserId(ctx.user, scope)
    const existingRow = await platformCredentialService.find({
      userId: scopedUserId,
      type: "threads",
    })
    const t = await getTranslations()
    const canReuseExistingSecret =
      scopedUserId === undefined ||
      (existingRow?.userId === scopedUserId &&
        !existingRow.usePlatformCredential)
    const existing =
      canReuseExistingSecret && existingRow
        ? await platformCredentialService.findDecrypted({
            userId: scopedUserId,
            type: "threads",
          })
        : undefined
    const clientSecret =
      parsedInput.clientSecret || existing?.config.clientSecret
    if (!clientSecret) {
      throw new Error(t("platformSettings.errors.threadsAppSecretRequired"))
    }

    const config: ThreadsCredential = {
      clientId: parsedInput.clientId,
      version: parsedInput.version,
      verifyToken: parsedInput.verifyToken,
      clientSecret,
    }

    await platformCredentialService.upsert({
      userId: scopedUserId,
      type: "threads",
      config,
    })
  })
