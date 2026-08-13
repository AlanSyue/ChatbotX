import { fbCommentAutomationService } from "@chatbotx.io/business"
import { assertCurrentUserCanAccessChatbot } from "@/lib/auth/utils"
import type {
  ListFbCommentsRequest,
  ListFbCommentsResponse,
} from "../schema/action"

export async function listFbComments(
  input: ListFbCommentsRequest,
): Promise<ListFbCommentsResponse> {
  await assertCurrentUserCanAccessChatbot(input.workspaceId)
  return fbCommentAutomationService.listForWorkspace({
    folderId: input.folderId,
    input,
  })
}

export async function getFbComment(workspaceId: string, id: string) {
  await assertCurrentUserCanAccessChatbot(workspaceId)

  const record = await fbCommentAutomationService.findFbChannelByIdForWorkspace(
    {
      id,
      workspaceId,
    },
  )

  if (!record) {
    throw new Error("FB Comment Automation not found")
  }

  return record
}
