import { createStore } from "zustand/vanilla"
import { client } from "@/lib/orpc/orpc"

export type LiveStory = {
  id: string
  media_url?: string
  thumbnail_url?: string
  timestamp?: string
  permalink?: string
  created_time?: string
  permalink_url?: string
}

export type StoryReplyStoryState = {
  loading: boolean
  error: string | null
  initialized: boolean
  workspaceId: string
  instagramStories: LiveStory[]
  facebookStories: LiveStory[]
}

export type StoryReplyStoryActions = {
  initialize: () => Promise<void>
}

export type StoryReplyStoryStore = StoryReplyStoryState & StoryReplyStoryActions

export const createStoryReplyStoryStore = (
  props: Partial<StoryReplyStoryState>,
) =>
  createStore<StoryReplyStoryStore>((set, get) => ({
    loading: false,
    error: null,
    initialized: false,
    workspaceId: "",
    instagramStories: [],
    facebookStories: [],
    ...props,
    initialize: async () => {
      const { initialized, workspaceId } = get()
      if (initialized) {
        return
      }
      set({ loading: true, error: null })
      try {
        const [instagramStoriesRes, facebookStoriesRes] = await Promise.all([
          client.storyReplyAutomationAPI.instagramStoriesAPI({ workspaceId }),
          client.storyReplyAutomationAPI.facebookStoriesAPI({ workspaceId }),
        ])
        set({
          instagramStories: instagramStoriesRes.stories,
          facebookStories: facebookStoriesRes.stories,
          initialized: true,
        })
      } catch (error) {
        set({
          error:
            error instanceof Error
              ? error.message
              : "Failed to fetch live stories",
          initialized: true,
        })
      } finally {
        set({ loading: false })
      }
    },
  }))
