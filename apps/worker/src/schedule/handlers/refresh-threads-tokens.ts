import {
  integrationThreadsService,
  withBlockedOwnerGuard,
} from "@chatbotx.io/business"
import {
  getSafeErrorDetails,
  integration as integrationThreads,
  type ThreadsAuthValue,
} from "@chatbotx.io/integration-threads"
import { distributedLock } from "@chatbotx.io/redis"
import { logger } from "../../lib/logger"

const BATCH_SIZE = 50
const REFRESH_LOCK_TIMEOUT_SECONDS = 10

async function refreshOne(integration: {
  id: string
  workspaceId: string
  currentAccessToken: string
}): Promise<void> {
  if (!integrationThreads.refreshAuth) {
    return
  }

  await distributedLock.runExclusive({
    key: `auth:refresh:threads:${integration.id}`,
    timeoutInSeconds: REFRESH_LOCK_TIMEOUT_SECONDS,
    fn: async () =>
      await withBlockedOwnerGuard(integration.workspaceId, async () => {
        const current = await integrationThreadsService.findByIdForWorkspace({
          id: integration.id,
          workspaceId: integration.workspaceId,
        })
        if (!current) {
          return
        }

        const auth = current.auth as ThreadsAuthValue
        const currentAccessToken = auth.tokens?.accessToken
        if (!currentAccessToken) {
          return
        }

        try {
          const refreshed = await integrationThreads.refreshAuth?.({ auth })
          await integrationThreadsService.updateAuthIfAccessTokenMatches({
            id: integration.id,
            workspaceId: integration.workspaceId,
            expectedCurrentAccessToken: currentAccessToken,
            auth: refreshed as ThreadsAuthValue,
          })
        } catch (error) {
          const safeError = getSafeErrorDetails(error)
          logger.warn(
            {
              integrationId: integration.id,
              workspaceId: integration.workspaceId,
              errorCode: safeError.code,
              errorHttpStatusCode: safeError.httpStatusCode,
              errorSubCode: safeError.subCode,
              errorType: safeError.type,
              errorMessage: safeError.message,
            },
            "[refreshThreadsTokens] refresh failed",
          )
        }
      }),
  })
}

export async function refreshThreadsTokens(): Promise<void> {
  if (!integrationThreads.refreshAuth) {
    logger.warn("[refreshThreadsTokens] integration does not support refresh")
    return
  }

  const integrations = await integrationThreadsService.listDueForTokenRefresh()

  for (let i = 0; i < integrations.length; i += BATCH_SIZE) {
    const batch = integrations.slice(i, i + BATCH_SIZE)
    await Promise.all(batch.map(refreshOne))
  }
}
