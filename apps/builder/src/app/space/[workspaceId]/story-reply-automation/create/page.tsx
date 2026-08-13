import { notFound } from "next/navigation"
import { CreateStoryReplyAutomationForm } from "@/features/story-reply-automation/components/create-story-reply-automation-form"
import { StoryReplyStoryStoreProvider } from "@/features/story-reply-automation/provider/story-reply-story-store-context"
import { withWorkspaceIdSchema } from "@/features/workspaces/schema/resource"

export default async function CreateStoryReplyAutomationPage(props: {
  params: Promise<{ workspaceId: string }>
}) {
  const { data } = withWorkspaceIdSchema.safeParse(await props.params)
  if (!data) {
    return notFound()
  }
  return (
    <StoryReplyStoryStoreProvider
      autoInitialize={true}
      workspaceId={data.workspaceId}
    >
      <CreateStoryReplyAutomationForm workspaceId={data.workspaceId} />
    </StoryReplyStoryStoreProvider>
  )
}
