"use server"

import {
  integrationThreadsService,
  platformCredentialService,
} from "@chatbotx.io/business"
import { ChatbotXException } from "@chatbotx.io/business/errors"
import type { WorkspaceModel } from "@chatbotx.io/database/types"
import { zodBigintAsString } from "@chatbotx.io/utils"
import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { getOriginUrlFromHeader } from "@/lib/domain"
import { resolveOwnerForWorkspace } from "@/lib/platform-credential-owner"
import { workspaceActionClient } from "@/lib/safe-action"
import { generateThreadsRedirectUri } from "../libs/oauth.server"

export const reconnectThreadsAction = workspaceActionClient
  .bindArgsSchemas([zodBigintAsString(), zodBigintAsString()])
  .action(
    async ({
      bindArgsParsedInputs: [workspaceId, integrationId],
      ctx,
    }: {
      bindArgsParsedInputs: readonly [string, string]
      ctx: {
        workspace: WorkspaceModel
        workspaceMemberPermissions?: { superAdmin?: boolean }
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

      const integrationThreads =
        await integrationThreadsService.findByIdForWorkspace({
          id: integrationId,
          workspaceId,
        })
      if (!integrationThreads) {
        throw new ChatbotXException(
          t("channels.reconnect.errors.notFound"),
          "notFound",
          404,
        )
      }

      const threadsCredential = await platformCredentialService.resolveForOwner(
        {
          ownerId: await resolveOwnerForWorkspace(ctx.workspace),
          type: "threads",
        },
      )
      if (!threadsCredential) {
        throw new ChatbotXException(
          t("messages.needToAddSettings"),
          "notFound",
          404,
        )
      }

      const baseUrl = await getOriginUrlFromHeader()
      if (!baseUrl) {
        throw new ChatbotXException(t("messages.unknownError"))
      }

      const authUrl = await generateThreadsRedirectUri({
        publicConfig: threadsCredential.publicConfig,
        workspaceId,
        origin: new URL(baseUrl).origin,
        reconnectIntegrationId: integrationId,
      })

      return redirect(authUrl)
    },
  )
