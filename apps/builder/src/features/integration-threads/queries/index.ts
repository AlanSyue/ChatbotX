import { integrationThreadsService } from "@chatbotx.io/business"

export const listIntegrationThreads = async ({
  workspaceId,
}: {
  workspaceId: string
}) => await integrationThreadsService.listPublicByWorkspaceId({ workspaceId })
