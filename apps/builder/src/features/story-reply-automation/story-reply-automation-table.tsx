"use client"

import { folderTypes } from "@chatbotx.io/database/partials"
import { DataTable } from "@chatbotx.io/ui/components/data-table/data-table"
import { DataTableColumnHeader } from "@chatbotx.io/ui/components/data-table/data-table-column-header"
import { DataTableToolbar } from "@chatbotx.io/ui/components/data-table/data-table-toolbar"
import { Button } from "@chatbotx.io/ui/components/ui/button"
import { Checkbox } from "@chatbotx.io/ui/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@chatbotx.io/ui/components/ui/dropdown-menu"
import { Switch } from "@chatbotx.io/ui/components/ui/switch"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@chatbotx.io/ui/components/ui/tooltip"
import { useDataTable } from "@chatbotx.io/ui/hooks/use-data-table"
import type { DataTableRowAction } from "@chatbotx.io/ui/types/data-table"
import type { ColumnDef } from "@tanstack/react-table"
import {
  FolderUpIcon,
  MoreHorizontalIcon,
  PencilIcon,
  TextIcon,
  Trash2Icon,
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import React, { use, useCallback, useMemo } from "react"
import { toast } from "sonner"
import { ChangeFolderDialog } from "../folders/change-folder"
import { BulkDeleteCommentAutomationsDialog } from "../shared/comment-automation/bulk-delete-comment-automations-dialog"
import { BulkMoveCommentAutomationFolderDialog } from "../shared/comment-automation/bulk-move-comment-automation-folder-dialog"
import { CommentAutomationScheduleDialog } from "../shared/comment-automation/comment-automation-schedule-dialog"
import { DeleteCommentAutomationDialog } from "../shared/comment-automation/delete-comment-automation-dialog"
import { RenameCommentAutomationDialog } from "../shared/comment-automation/rename-comment-automation-dialog"
import { deleteStoryReplyAutomationAction } from "./actions/delete-story-reply-automation.action"
import { updateStoryReplyAutomationAction } from "./actions/update-story-reply-automation.action"
import type { listStoryReplyAutomations } from "./queries"
import type { ListStoryReplyAutomationsResponse } from "./schema/action"

export function StoryReplyAutomationTable({
  workspaceId,
  promises,
}: {
  workspaceId: string
  promises: Promise<[Awaited<ReturnType<typeof listStoryReplyAutomations>>]>
}) {
  const t = useTranslations()
  const router = useRouter()
  const [{ data, pageCount }] = use(promises)
  const [rowAction, setRowAction] = React.useState<DataTableRowAction<
    ListStoryReplyAutomationsResponse["data"][number]
  > | null>(null)
  const [scheduleDialogItem, setScheduleDialogItem] = React.useState<
    ListStoryReplyAutomationsResponse["data"][number] | null
  >(null)

  const handleToggleStatus = useCallback(
    async (item: ListStoryReplyAutomationsResponse["data"][number]) => {
      if (!item.isActive) {
        setScheduleDialogItem(item)
        return
      }
      try {
        await updateStoryReplyAutomationAction(workspaceId, item.id, {
          isActive: false,
        })
        toast.success(t("storyReplyAutomation.deactivated"))
        router.refresh()
      } catch {
        toast.error(t("messages.unknownError"))
      }
    },
    [workspaceId, t, router],
  )

  const columns = useMemo<
    ColumnDef<ListStoryReplyAutomationsResponse["data"][number]>[]
  >(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            aria-label={t("actions.selectAll")}
            checked={table.getIsAllPageRowsSelected()}
            className="translate-y-0.5 cursor-pointer"
            indeterminate={table.getIsSomePageRowsSelected()}
            onCheckedChange={(value) =>
              table.toggleAllPageRowsSelected(Boolean(value))
            }
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            aria-label={t("actions.selectRow")}
            checked={row.getIsSelected()}
            className="translate-y-0.5 cursor-pointer"
            onCheckedChange={(value) => row.toggleSelected(Boolean(value))}
          />
        ),
        size: 50,
      },
      {
        id: "name",
        accessorKey: "name",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title={t("fields.name.label")}
          />
        ),
        cell: ({ row }) => (
          <div className="max-w-75 truncate">
            <Tooltip>
              <TooltipTrigger
                render={(triggerProps) => (
                  <Link
                    {...triggerProps}
                    className="truncate"
                    href={`/space/${workspaceId}/story-reply-automation/${row.original.id}`}
                  >
                    {row.original.name ?? ""}
                  </Link>
                )}
              />
              <TooltipContent>
                <p>{row.original.name}</p>
              </TooltipContent>
            </Tooltip>
          </div>
        ),
        meta: {
          label: t("fields.name.label"),
          placeholder: t("fields.name.placeholder"),
          variant: "text",
        },
        size: 300,
      },
      {
        accessorKey: "isActive",
        header: ({ column }) => (
          <DataTableColumnHeader
            className="w-full justify-center"
            column={column}
            title={t("fields.status.label")}
          />
        ),
        cell: ({ row }) => (
          <div className="flex justify-center">
            <Switch
              checked={row.original.isActive}
              onCheckedChange={() => handleToggleStatus(row.original)}
            />
          </div>
        ),
        size: 100,
      },
      {
        accessorKey: "repliesCount",
        header: ({ column }) => (
          <DataTableColumnHeader
            className="w-full justify-center"
            column={column}
            title={t("storyReplyAutomation.replies")}
          />
        ),
        cell: ({ row }) => (
          <div className="text-center">{row.original.repliesCount}</div>
        ),
        size: 100,
      },
      {
        id: "actions",
        header: () => (
          <div className="w-full text-center">{t("actions.actions")}</div>
        ),
        cell: ({ row }) => (
          <div className="flex justify-center">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={(triggerProps) => (
                  <Button {...triggerProps} size="icon" variant="ghost">
                    <MoreHorizontalIcon className="h-4 w-4" />
                  </Button>
                )}
              />
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() =>
                    router.push(
                      `/space/${workspaceId}/story-reply-automation/${row.original.id}`,
                    )
                  }
                >
                  <PencilIcon className="me-2" />
                  {t("actions.edit")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setRowAction({ row, variant: "update" })}
                >
                  <TextIcon className="me-2" />
                  {t("actions.rename")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setRowAction({ row, variant: "move" })}
                >
                  <FolderUpIcon className="me-2" />
                  {t("actions.move")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="hover:bg-muted hover:text-destructive"
                  onClick={() => setRowAction({ row, variant: "delete" })}
                >
                  <Trash2Icon className="me-2" />
                  {t("actions.delete")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
        size: 50,
      },
    ],
    [handleToggleStatus, router, t, workspaceId],
  )

  const { table } = useDataTable({
    data,
    columns,
    pageCount,
    initialState: {
      sorting: [{ id: "createdAt", desc: true }],
      columnPinning: { right: ["actions"] },
    },
    getRowId: (originalRow) => originalRow.id,
    clearOnDefault: true,
    shallow: false,
  })

  const selectedRows = table.getFilteredSelectedRowModel().rows

  return (
    <>
      <DataTable table={table}>
        <DataTableToolbar table={table}>
          <div className="flex items-center gap-2">
            {selectedRows.length > 0 ? (
              <>
                <BulkDeleteCommentAutomationsDialog
                  deleteAction={deleteStoryReplyAutomationAction}
                  items={selectedRows.map((row) => row.original)}
                  onOpenChange={() => setRowAction(null)}
                  onSuccess={() => {
                    table.toggleAllRowsSelected(false)
                    router.refresh()
                  }}
                  translationNamespace="storyReplyAutomation"
                />
                <BulkMoveCommentAutomationFolderDialog
                  folderType={folderTypes.enum.storyReply}
                  items={selectedRows.map((row) => row.original)}
                  onOpenChange={() => setRowAction(null)}
                  onSuccess={() => {
                    table.toggleAllRowsSelected(false)
                    router.refresh()
                  }}
                  translationNamespace="storyReplyAutomation"
                  workspaceId={workspaceId}
                />
              </>
            ) : null}
            <Link href={`/space/${workspaceId}/story-reply-automation/create`}>
              <Button size="sm">{t("storyReplyAutomation.create")}</Button>
            </Link>
          </div>
        </DataTableToolbar>
      </DataTable>
      <RenameCommentAutomationDialog
        action={updateStoryReplyAutomationAction.bind(
          null,
          rowAction?.row.original?.workspaceId ?? "",
          rowAction?.row.original?.id ?? "",
        )}
        onOpenChange={() => setRowAction(null)}
        onSuccess={() => router.refresh()}
        open={rowAction?.variant === "update"}
        resource={rowAction?.row.original || null}
        translationNamespace="storyReplyAutomation"
      />
      <ChangeFolderDialog
        currentFolderId={rowAction?.row.original?.folderId || null}
        folderType={folderTypes.enum.storyReply}
        modelIds={rowAction?.row.original ? [rowAction.row.original.id] : []}
        onOpenChange={() => setRowAction(null)}
        open={rowAction?.variant === "move"}
        workspaceId={workspaceId}
      />
      <DeleteCommentAutomationDialog
        action={deleteStoryReplyAutomationAction.bind(
          null,
          rowAction?.row.original?.workspaceId ?? "",
          rowAction?.row.original?.id ?? "",
        )}
        onOpenChange={() => setRowAction(null)}
        onSuccess={() => router.refresh()}
        open={rowAction?.variant === "delete"}
        resource={rowAction?.row.original || null}
        translationNamespace="storyReplyAutomation"
      />
      <CommentAutomationScheduleDialog
        action={updateStoryReplyAutomationAction.bind(
          null,
          scheduleDialogItem?.workspaceId ?? "",
          scheduleDialogItem?.id ?? "",
        )}
        onOpenChange={() => setScheduleDialogItem(null)}
        onSuccess={() => router.refresh()}
        open={!!scheduleDialogItem}
        resource={scheduleDialogItem}
        translationNamespace="storyReplyAutomation"
      />
    </>
  )
}
