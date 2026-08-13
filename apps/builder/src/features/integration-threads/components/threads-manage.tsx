"use client"

import type { ThreadsCredentialPublic } from "@chatbotx.io/database/partials"
import { Button } from "@chatbotx.io/ui/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@chatbotx.io/ui/components/ui/table"
import { PlusCircleIcon } from "lucide-react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { use } from "react"
import { useChannelDuplicatedError } from "@/hooks/use-channel-duplicated-error"
import { useChannelReconnectResult } from "@/hooks/use-channel-reconnect-result"
import type { listIntegrationThreads } from "../queries"
import { ThreadsDisconnect } from "./threads-disconnect"
import { ThreadsReconnect } from "./threads-reconnect"

type ThreadsManageProps = {
  canCreate: boolean
  publicConfig: ThreadsCredentialPublic | null
  workspaceId: string
  promises: Promise<[Awaited<ReturnType<typeof listIntegrationThreads>>]>
}

export function ThreadsManage({
  canCreate,
  publicConfig,
  workspaceId,
  promises,
}: ThreadsManageProps) {
  const [{ data: integrationThreads }] = use(promises)
  const t = useTranslations()

  useChannelDuplicatedError("threads")
  useChannelReconnectResult()

  if (!publicConfig?.clientId) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-muted-foreground text-sm">
          {t("messages.needToAddSettings")}
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {canCreate ? (
        <div className="flex justify-end gap-2">
          <Button
            render={
              <Link
                className="inline-flex"
                href={`/channels/create/threads${workspaceId ? `?workspaceId=${workspaceId}` : ""}`}
              />
            }
            type="button"
            variant="secondary"
          >
            <PlusCircleIcon className="h-4 w-4" />
            {t("actions.addFeature", {
              feature: t("fields.threads.label"),
            })}
          </Button>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("fields.name.label")}</TableHead>
              <TableHead>{t("fields.username.label")}</TableHead>
              <TableHead className="w-50" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {integrationThreads.map((integrationThreadsRow) => (
              <TableRow key={integrationThreadsRow.id}>
                <TableCell>{integrationThreadsRow.name}</TableCell>
                <TableCell>{integrationThreadsRow.username}</TableCell>
                <TableCell className="flex w-50 justify-end gap-2">
                  <ThreadsReconnect
                    integrationThreads={integrationThreadsRow}
                  />
                  <ThreadsDisconnect
                    integrationThreads={integrationThreadsRow}
                  />
                </TableCell>
              </TableRow>
            ))}
            {integrationThreads.length === 0 && (
              <TableRow>
                <TableCell colSpan={3}>{t("messages.noData")}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
