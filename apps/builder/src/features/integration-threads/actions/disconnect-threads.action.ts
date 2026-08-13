"use server"

import { integrationThreadsService } from "@chatbotx.io/business"
import { ChatbotXException } from "@chatbotx.io/business/errors"
import { zodBigintAsString } from "@chatbotx.io/utils"
import { getTranslations } from "next-intl/server"
import { workspaceActionClientAllowExpired } from "@/lib/safe-action"

export const disconnectThreadsAction = workspaceActionClientAllowExpired
  .bindArgsSchemas([zodBigintAsString(), zodBigintAsString()])
  .action(
    async ({
      bindArgsParsedInputs: [workspaceId, id],
      ctx,
    }: {
      bindArgsParsedInputs: readonly [string, string]
      ctx: {
        workspaceMemberPermissions?: {
          superAdmin?: boolean
        }
      }
    }) => {
      const t = await getTranslations()
      if (!ctx.workspaceMemberPermissions?.superAdmin) {
        throw new ChatbotXException(
          t("workspace.schedule.permissionRequired"),
          "forbidden",
          403,
        )
      }

      const disconnected = await integrationThreadsService.disconnect({
        workspaceId,
        id,
      })
      if (!disconnected) {
        throw new ChatbotXException(
          t("channels.reconnect.errors.notFound"),
          "notFound",
          404,
        )
      }
    },
  )
