import {
  isWorkspaceScheduledForDeletion,
  workspaceService,
} from "@chatbotx.io/business"
import { ORPCError } from "@orpc/server"
import { base } from "./context"
import { extractWorkspaceBearerToken } from "./workspace-token"

export const workspaceTokenAuthMidddleware = base.middleware(
  async ({ context, next }) => {
    const token = extractWorkspaceBearerToken(context.headers)
    if (!token) {
      throw new ORPCError("UNAUTHORIZED", {
        message: "INVALID_CHATBOT_TOKEN",
      })
    }

    const workspace = await workspaceService.find({ where: { token } })
    if (!workspace) {
      throw new ORPCError("UNAUTHORIZED", {
        message: "INVALID_CHATBOT_TOKEN",
      })
    }

    if (isWorkspaceScheduledForDeletion(workspace)) {
      throw new ORPCError("FORBIDDEN", {
        message: "Workspace deletion scheduled",
      })
    }

    // Adds session and user to the context
    return await next({
      context: {
        workspace,
      },
    })
  },
)
