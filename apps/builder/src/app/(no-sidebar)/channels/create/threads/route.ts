import {
  platformCredentialService,
  resolveWorkspaceFreezeReason,
  userQuotaService,
  workspaceService,
} from "@chatbotx.io/business"
import { getPublicUrlFromRequest } from "@chatbotx.io/utils"
import { notFound, redirect } from "next/navigation"
import type { NextRequest } from "next/server"
import { isCloud } from "@/env"
import { generateThreadsRedirectUri } from "@/features/integration-threads/libs/oauth.server"
import { requireWorkspacePermission } from "@/lib/auth/require-workspace-permission"
import { getCurrentUserId } from "@/lib/auth/utils"
import { getOriginUrlFromHeader } from "@/lib/domain"
import { isAllowedOrigin } from "@/lib/oauth-referer"
import { resolveOwnerForWorkspace } from "@/lib/platform-credential-owner"

export async function GET(req: NextRequest) {
  const workspaceId = req.nextUrl.searchParams.get("workspaceId")
  if (!workspaceId) {
    return notFound()
  }

  await requireWorkspacePermission(workspaceId, "superAdmin")

  const userId = await getCurrentUserId()
  if (!userId) {
    return notFound()
  }

  const workspace = await workspaceService.findById({ id: workspaceId })
  if (!workspace) {
    return notFound()
  }

  const accessState = isCloud()
    ? await userQuotaService.getAccessState(workspace.ownerId)
    : null
  const freezeReason = resolveWorkspaceFreezeReason({ accessState, workspace })
  if (freezeReason) {
    return notFound()
  }

  const threads = await platformCredentialService.resolveForOwner({
    ownerId: await resolveOwnerForWorkspace(workspace),
    type: "threads",
  })
  if (!threads) {
    return notFound()
  }

  const requestedOrigin =
    (await getOriginUrlFromHeader()) || getPublicUrlFromRequest(req).toString()

  let origin: string
  try {
    const targetUrl = new URL(requestedOrigin)
    if (!(await isAllowedOrigin(targetUrl))) {
      return notFound()
    }
    origin = targetUrl.origin
  } catch {
    return notFound()
  }

  const redirectUri = await generateThreadsRedirectUri({
    publicConfig: threads.publicConfig,
    workspaceId,
    origin,
  })
  redirect(redirectUri)
}
