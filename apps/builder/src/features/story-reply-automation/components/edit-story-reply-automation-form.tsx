"use client"

import { Form } from "@chatbotx.io/ui/components/ui/form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useAction } from "next-safe-action/hooks"
import { type Resolver, type UseFormReturn, useForm } from "react-hook-form"
import { toast } from "sonner"
import { updateStoryReplyAutomationAction } from "../actions/update-story-reply-automation.action"
import {
  type CreateStoryReplyAutomationRequest,
  createStoryReplyAutomationRequest,
} from "../schema/action"
import type { StoryReplyAutomationResource } from "../schema/resource"
import { StoryReplyAutomationForm } from "./story-reply-automation-form"

export function EditStoryReplyAutomationForm({
  workspaceId,
  initialData,
}: {
  workspaceId: string
  initialData: StoryReplyAutomationResource
}) {
  const t = useTranslations()
  const router = useRouter()
  const form = useForm<CreateStoryReplyAutomationRequest>({
    resolver: zodResolver(
      createStoryReplyAutomationRequest,
    ) as Resolver<CreateStoryReplyAutomationRequest>,
    mode: "onChange",
    defaultValues: {
      name: initialData.name,
      type: initialData.type as CreateStoryReplyAutomationRequest["type"],
      folderId: initialData.folderId ?? undefined,
      isActive: initialData.isActive,
      storyTarget: initialData.storyTarget,
      includeKeywords: initialData.includeKeywords,
      excludeKeywords: initialData.excludeKeywords,
      reply: initialData.reply,
      replyAfter: initialData.replyAfter,
    },
  })
  const { execute, isPending } = useAction(
    updateStoryReplyAutomationAction.bind(null, workspaceId, initialData.id),
    {
      onSuccess: () => {
        toast.success(
          t("messages.updatedSuccess", {
            feature: t("storyReplyAutomation.title"),
          }),
        )
        router.refresh()
      },
    },
  )

  return (
    <Form {...form}>
      <StoryReplyAutomationForm
        form={
          form as unknown as UseFormReturn<CreateStoryReplyAutomationRequest>
        }
        isSubmitting={isPending}
        onCancel={() =>
          router.push(`/space/${workspaceId}/story-reply-automation`)
        }
        onSubmit={form.handleSubmit((data) => execute(data))}
        submitLabel={t("actions.save")}
      />
    </Form>
  )
}
