import {
  platformCredentialService,
  workspaceService,
} from "@chatbotx.io/business"
import { getIdFromParams } from "@chatbotx.io/utils"
import { notFound } from "next/navigation"
import { listIntegrationThreads } from "@/features/integration-threads/queries"
import { ThreadsManage } from "@/features/integration-threads/threads-manage"

export default async function SettingChannelThreadsPage(props: {
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
    ownerId: workspace.ownerId,
    type: "threads",
  })

  const promises = Promise.all([
    listIntegrationThreads({
      workspaceId,
    }),
  ])

  return (
    <ThreadsManage
      promises={promises}
      publicConfig={credential?.publicConfig ?? null}
      workspaceId={workspaceId}
    />
  )
}
