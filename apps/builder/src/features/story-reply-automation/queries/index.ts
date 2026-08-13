import { storyReplyAutomationService } from "@chatbotx.io/business"
import { assertCurrentUserCanAccessChatbot } from "@/lib/auth/utils"
import type {
  ListStoryReplyAutomationsRequest,
  ListStoryReplyAutomationsResponse,
} from "../schema/action"

export async function listStoryReplyAutomations(
  input: ListStoryReplyAutomationsRequest,
): Promise<ListStoryReplyAutomationsResponse> {
  await assertCurrentUserCanAccessChatbot(input.workspaceId)
  return await listStoryReplyAutomationsForWorkspace(input)
}

export async function listStoryReplyAutomationsForWorkspace(
  input: ListStoryReplyAutomationsRequest,
): Promise<ListStoryReplyAutomationsResponse> {
  return await storyReplyAutomationService.list({
    workspaceId: input.workspaceId,
    folderId: input.folderId,
    page: input.page ?? 1,
    perPage: input.perPage ?? 10,
    keyword: input.name,
    sort: input.sort ?? [{ id: "createdAt", desc: true }],
  })
}

export async function getStoryReplyAutomation(workspaceId: string, id: string) {
  await assertCurrentUserCanAccessChatbot(workspaceId)
  return await storyReplyAutomationService.findOrFail({ workspaceId, id })
}

export async function findStoryReplyAutomationForWorkspace(
  workspaceId: string,
  id: string,
) {
  return await storyReplyAutomationService.find({ workspaceId, id })
}
