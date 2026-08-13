import { messengerIntegrationService } from "@chatbotx.io/business"
import {
  type FacebookStoryListItem,
  listFacebookPageStories,
} from "@chatbotx.io/integration-messenger"
import type { MessengerAuthValue } from "@chatbotx.io/integration-messenger/schema"

export type FacebookAutomationStory = {
  id: string
  media_url?: string
  created_time?: string
  permalink_url?: string
}

export async function listFacebookAutomationStories(
  workspaceId: string,
): Promise<{ stories: FacebookAutomationStory[] }> {
  const integrations =
    await messengerIntegrationService.findByWorkspaceId(workspaceId)
  if (integrations.length === 0) {
    return { stories: [] }
  }

  const results = await Promise.allSettled(
    integrations.map(async (integration) => {
      const auth = integration.auth as MessengerAuthValue
      const stories = await listFacebookPageStories({
        auth,
        pageId: integration.pageId,
      })

      return stories
        .filter(
          (
            item: FacebookStoryListItem,
          ): item is FacebookStoryListItem & {
            id: string
          } => Boolean(item.id),
        )
        .map<FacebookAutomationStory>((item: FacebookStoryListItem) => ({
          id: item.id,
          media_url: item.media_url ?? item.picture,
          created_time: item.created_time,
          permalink_url: item.permalink_url,
        }))
    }),
  )

  return {
    stories: results
      .filter(
        (r): r is PromiseFulfilledResult<FacebookAutomationStory[]> =>
          r.status === "fulfilled",
      )
      .flatMap((r) => r.value),
  }
}
