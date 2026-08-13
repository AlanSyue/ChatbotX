import { notFound } from "next/navigation"
import { EditStoryReplyAutomationForm } from "@/features/story-reply-automation/components/edit-story-reply-automation-form"
import { StoryReplyStoryStoreProvider } from "@/features/story-reply-automation/provider/story-reply-story-store-context"
import { getStoryReplyAutomation } from "@/features/story-reply-automation/queries"
import { withWorkspaceIdAndIdSchema } from "@/features/workspaces/schema/resource"

export default async function EditStoryReplyAutomationPage(props: {
  params: Promise<{ workspaceId: string; id: string }>
}) {
  const { data } = withWorkspaceIdAndIdSchema.safeParse(await props.params)
  if (!data) {
    return notFound()
  }
  let automation: Awaited<ReturnType<typeof getStoryReplyAutomation>>
  try {
    automation = await getStoryReplyAutomation(data.workspaceId, data.id)
  } catch {
    return notFound()
  }
  return (
    <StoryReplyStoryStoreProvider
      autoInitialize={true}
      workspaceId={data.workspaceId}
    >
      <EditStoryReplyAutomationForm
        initialData={automation}
        workspaceId={data.workspaceId}
      />
    </StoryReplyStoryStoreProvider>
  )
}
