import { zodBigintAsString } from "@chatbotx.io/utils"
import { z } from "zod"
import { buildBrokerCallbackUrl } from "@/lib/oauth-broker"

export const THREADS_OAUTH_STATE_COOKIE = "threads_oauth_state"
export const THREADS_OAUTH_STATE_MAX_AGE = 600

export const threadsOAuthStateCookieSchema = z.object({
  nonce: z.string().min(1),
  workspaceId: zodBigintAsString(),
  reconnectIntegrationId: zodBigintAsString().optional(),
})

export type ThreadsOAuthStateCookie = z.infer<
  typeof threadsOAuthStateCookieSchema
>

export function buildThreadsReferer(
  workspaceId: string,
  origin: string,
): string {
  return new URL(
    `/space/${workspaceId}/settings/channels?channel=threads`,
    origin,
  ).toString()
}

export function buildThreadsWebhookUrl(clientId: string): string {
  return buildBrokerCallbackUrl(
    `/integrations/threads/webhook?appId=${encodeURIComponent(clientId)}`,
  )
}
