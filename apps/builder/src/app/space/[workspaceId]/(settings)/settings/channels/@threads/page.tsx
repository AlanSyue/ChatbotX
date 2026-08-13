import {
  platformCredentialService,
  workspaceService,
} from "@chatbotx.io/business"
import { getIdFromParams } from "@chatbotx.io/utils"
import { notFound } from "next/navigation"
import { ThreadsManage } from "@/features/integration-threads/components/threads-manage"
import { listIntegrationThreads } from "@/features/integration-threads/queries"
import { resolveOwnerForWorkspace } from "@/lib/platform-credential-owner"
import { resolveChannelCreatable } from "@/lib/workspace/resolve-channel-creatable"

export default async function SettingsChannelThreadsPage(props: {
  params: Promise<{ workspaceId: string }>
}) {
  const workspaceId = getIdFromParams(await props.params, "workspaceId")
  if (!workspaceId) {
    return notFound()
  }

  const workspace = await workspaceService.find({ where: { id: workspaceId } })
  if (!workspace) {
    return notFound()
  }

  const credential = await platformCredentialService.resolveForOwner({
    ownerId: await resolveOwnerForWorkspace(workspace),
    type: "threads",
  })

  const promises = Promise.all([
    listIntegrationThreads({
      workspaceId,
    }),
  ])
  const canCreate = await resolveChannelCreatable(workspaceId, "threads")

  return (
    <ThreadsManage
      canCreate={canCreate}
      promises={promises}
      publicConfig={credential?.publicConfig ?? null}
      workspaceId={workspaceId}
    />
  )
}
