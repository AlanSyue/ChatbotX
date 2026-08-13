"use client"

import { Form } from "@chatbotx.io/ui/components/ui/form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useHookFormAction } from "@next-safe-action/adapter-react-hook-form/hooks"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import type { UseFormReturn } from "react-hook-form"
import { toast } from "sonner"
import { createStoryReplyAutomationAction } from "../actions/create-story-reply-automation.action"
import {
  type CreateStoryReplyAutomationRequest,
  createStoryReplyAutomationRequest,
} from "../schema/action"
import { StoryReplyAutomationForm } from "./story-reply-automation-form"

export function CreateStoryReplyAutomationForm({
  workspaceId,
}: {
  workspaceId: string
}) {
  const t = useTranslations()
  const router = useRouter()
  const { form, handleSubmitWithAction } = useHookFormAction(
    createStoryReplyAutomationAction.bind(null, workspaceId),
    zodResolver(createStoryReplyAutomationRequest),
    {
      actionProps: {
        onSuccess: () => {
          toast.success(
            t("messages.createdSuccess", {
              feature: t("storyReplyAutomation.title"),
            }),
          )
          router.push(`/space/${workspaceId}/story-reply-automation`)
        },
      },
      formProps: {
        mode: "onChange",
        defaultValues: {
          name: "",
          type: "messenger",
          folderId: undefined,
          isActive: true,
          storyTarget: { type: "all", value: [] },
          includeKeywords: { type: "all", value: [] },
          excludeKeywords: [],
          reply: { type: "text", value: "" },
          replyAfter: { type: "immediately", value: 0 },
        },
      },
    },
  )

  return (
    <Form {...form}>
      <StoryReplyAutomationForm
        form={
          form as unknown as UseFormReturn<CreateStoryReplyAutomationRequest>
        }
        isSubmitting={form.formState.isSubmitting}
        onCancel={() =>
          router.push(`/space/${workspaceId}/story-reply-automation`)
        }
        onSubmit={handleSubmitWithAction}
        submitLabel={t("actions.create")}
      />
    </Form>
  )
}
