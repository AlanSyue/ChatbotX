"use client"

import type { IntegrationThreadsPublicResource } from "@chatbotx.io/business"
import { Button } from "@chatbotx.io/ui/components/ui/button"
import { Loader2Icon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useAction } from "next-safe-action/hooks"
import { toast } from "sonner"
import { useWorkspaceId } from "@/hooks/routing"
import { reconnectThreadsAction } from "../actions/reconnect.action"

export function ThreadsReconnect({
  integrationThreads,
}: {
  integrationThreads: IntegrationThreadsPublicResource
}) {
  const t = useTranslations()
  const workspaceId = useWorkspaceId()

  const { execute, isPending } = useAction(
    reconnectThreadsAction.bind(null, workspaceId, integrationThreads.id),
    {
      onError: ({ error }) => {
        if (error.serverError) {
          toast.error(error.serverError)
          return
        }
        toast.error(t("messages.unknownError"))
      },
    },
  )

  return (
    <Button
      disabled={isPending}
      onClick={() => execute()}
      size="sm"
      variant="secondary"
    >
      {isPending && <Loader2Icon className="animate-spin" />}
      {t("messenger.reconnect")}
    </Button>
  )
}
