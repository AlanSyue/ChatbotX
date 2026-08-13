"use client"

import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
} from "react"
import { useStore } from "zustand"
import {
  createStoryReplyStoryStore,
  type StoryReplyStoryStore,
} from "./story-reply-story-store"

type StoryReplyStoryStoreApi = ReturnType<typeof createStoryReplyStoryStore>

const StoryReplyStoryStoreContext = createContext<
  StoryReplyStoryStoreApi | undefined
>(undefined)

export const StoryReplyStoryStoreProvider = ({
  workspaceId,
  autoInitialize = true,
  children,
}: {
  workspaceId: string
  autoInitialize?: boolean
  children: ReactNode
}) => {
  const storeRef = useRef<StoryReplyStoryStoreApi>(null)
  if (!storeRef.current) {
    storeRef.current = createStoryReplyStoryStore({ workspaceId })
  }

  useEffect(() => {
    if (autoInitialize) {
      storeRef.current?.getState().initialize()
    }
  }, [autoInitialize])

  return (
    <StoryReplyStoryStoreContext.Provider value={storeRef.current}>
      {children}
    </StoryReplyStoryStoreContext.Provider>
  )
}

export const useStoryReplyStoryStore = <T,>(
  selector: (store: StoryReplyStoryStore) => T,
): T => {
  const context = useContext(StoryReplyStoryStoreContext)
  if (!context) {
    throw new Error(
      "useStoryReplyStoryStore must be used within StoryReplyStoryStoreProvider",
    )
  }
  return useStore(context, selector)
}
