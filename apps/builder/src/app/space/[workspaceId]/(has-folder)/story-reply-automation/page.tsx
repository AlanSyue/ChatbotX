import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@chatbotx.io/ui/components/ui/card"
import { getIdFromParams } from "@chatbotx.io/utils"
import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import type { SearchParams } from "nuqs/server"
import { listStoryReplyAutomations } from "@/features/story-reply-automation/queries"
import { listStoryReplyAutomationsSearchParamsCache } from "@/features/story-reply-automation/schema/action"
import { StoryReplyAutomationTable } from "@/features/story-reply-automation/story-reply-automation-table"

export default async function StoryReplyAutomationsPage(props: {
  params: Promise<{ workspaceId: string }>
  searchParams: Promise<SearchParams>
}) {
  const workspaceId = getIdFromParams(await props.params, "workspaceId")
  if (!workspaceId) {
    return notFound()
  }
  const searchParams = await props.searchParams
  const search =
    await listStoryReplyAutomationsSearchParamsCache.parse(searchParams)
  const t = await getTranslations()
  const promises = Promise.all([
    listStoryReplyAutomations({ ...search, workspaceId }),
  ])
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-bold text-xl">
          {t("storyReplyAutomation.title")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <StoryReplyAutomationTable
          promises={promises}
          workspaceId={workspaceId}
        />
      </CardContent>
    </Card>
  )
}
