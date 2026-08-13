import { workspaceTokenAuthAPI } from "@/orpc"
import { getWorkspacePublicResource } from "../schema/action"

export const workspaceWorkspaceTokenAPIs = {
  getWorkspaceWorkspaceTokenAPI: workspaceTokenAuthAPI
    .route({
      method: "GET",
      path: "/v1/workspaces",
      summary: "Get workspace",
      tags: ["Workspace"],
    })
    .output(getWorkspacePublicResource)
    .handler(({ context }) => {
      const { token: _token, ...workspace } = context.workspace
      return {
        ...workspace,
        createdAt: new Date(String(workspace.createdAt)),
        updatedAt: new Date(String(workspace.updatedAt)),
      }
    }),
}

export default workspaceWorkspaceTokenAPIs
