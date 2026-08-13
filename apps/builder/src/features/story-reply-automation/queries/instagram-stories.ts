import { instagramIntegrationService } from "@chatbotx.io/business"
import {
  type InstagramAuthValue,
  listInstagramStories,
} from "@chatbotx.io/integration-instagram"

export type InstagramAutomationStory = {
  id: string
  media_url?: string
  thumbnail_url?: string
  timestamp: string
  permalink?: string
}

export async function listInstagramAutomationStories(
  workspaceId: string,
): Promise<{ stories: InstagramAutomationStory[] }> {
  const integrations =
    await instagramIntegrationService.findByWorkspaceId(workspaceId)

  const results = await Promise.allSettled(
    integrations
      .filter((integration) => integration.type !== "facebook")
      .map(async (integration) => {
        const stories = await listInstagramStories({
          auth: integration.auth as InstagramAuthValue,
        })

        return stories.map<InstagramAutomationStory>((item) => ({
          id: item.id,
          media_url: item.media_url ?? item.thumbnail_url,
          thumbnail_url: item.thumbnail_url,
          timestamp: item.timestamp,
          permalink: item.permalink,
        }))
      }),
  )

  return {
    stories: results
      .filter(
        (
          result,
        ): result is PromiseFulfilledResult<InstagramAutomationStory[]> =>
          result.status === "fulfilled",
      )
      .flatMap((result) => result.value),
  }
}
