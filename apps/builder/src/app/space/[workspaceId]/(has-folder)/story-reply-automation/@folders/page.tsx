import SharedFolderSlot from "@/features/folders/shared-folder-slot"

export default async function StoryReplyAutomationFoldersPage(props: {
  params: Promise<{ workspaceId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await props.params
  return (
    <SharedFolderSlot
      searchParams={Promise.resolve(await props.searchParams)}
      workspaceId={params.workspaceId}
    />
  )
}
