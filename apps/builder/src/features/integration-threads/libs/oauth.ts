"use server"

import type { ThreadsCredentialPublic } from "@chatbotx.io/database/partials"
import { generateAuthUrl } from "@chatbotx.io/integration-threads"
import { zodBigintAsString } from "@chatbotx.io/utils"
import { cookies } from "next/headers"
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

export async function setThreadsOAuthStateCookie(
  value: ThreadsOAuthStateCookie,
): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(
    THREADS_OAUTH_STATE_COOKIE,
    Buffer.from(JSON.stringify(value)).toString("base64url"),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: THREADS_OAUTH_STATE_MAX_AGE,
      path: "/integrations/threads/callback",
    },
  )
}

export async function getThreadsOAuthStateCookie(): Promise<ThreadsOAuthStateCookie | null> {
  const cookieStore = await cookies()
  const raw = cookieStore.get(THREADS_OAUTH_STATE_COOKIE)?.value
  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString())
    return threadsOAuthStateCookieSchema.parse(parsed)
  } catch {
    return null
  }
}

export async function clearThreadsOAuthStateCookie(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(THREADS_OAUTH_STATE_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/integrations/threads/callback",
  })
}

export async function generateThreadsRedirectUri(props: {
  publicConfig: ThreadsCredentialPublic
  workspaceId: string
  origin: string
  reconnectIntegrationId?: string
}) {
  const redirectUrl = buildBrokerCallbackUrl("/integrations/threads/callback")
  const referer = buildThreadsReferer(props.workspaceId, props.origin)
  const nonce = crypto.randomUUID()

  await setThreadsOAuthStateCookie({
    nonce,
    workspaceId: props.workspaceId,
    ...(props.reconnectIntegrationId
      ? { reconnectIntegrationId: props.reconnectIntegrationId }
      : {}),
  })

  return generateAuthUrl({
    clientId: props.publicConfig.clientId,
    redirectUrl,
    stateParams: {
      workspaceId: props.workspaceId,
      referer,
      nonce,
      ...(props.reconnectIntegrationId
        ? { reconnectIntegrationId: props.reconnectIntegrationId }
        : {}),
    },
  })
}
