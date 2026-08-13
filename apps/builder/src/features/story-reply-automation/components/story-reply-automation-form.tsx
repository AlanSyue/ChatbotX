"use client"

import { ComboboxField } from "@chatbotx.io/ui/components/form/combobox-field"
import { InputField } from "@chatbotx.io/ui/components/form/input-field"
import { RadioGroupField } from "@chatbotx.io/ui/components/form/radio-group-field"
import { SelectField } from "@chatbotx.io/ui/components/form/select-field"
import { SwitchField } from "@chatbotx.io/ui/components/form/switch-field"
import { Button } from "@chatbotx.io/ui/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@chatbotx.io/ui/components/ui/card"
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@chatbotx.io/ui/components/ui/form"
import { TagsInputField } from "@chatbotx.io/ui/components/ui/muhammada86/tags-input-field"
import { useTranslations } from "next-intl"
import { useEffect, useRef, useState } from "react"
import type { UseFormReturn } from "react-hook-form"
import { useWatch } from "react-hook-form"
import { useAIAgentStore } from "@/features/ai-agents/provider/ai-agent-store-context"
import { useFlowSelectOptions } from "@/features/flows/provider/flow-hook"
import type { CreateStoryReplyAutomationRequest } from "../schema/action"
import { SelectStoriesDialog } from "./select-stories-dialog"

export function StoryReplyAutomationForm({
  form,
  onSubmit,
  isSubmitting,
  onCancel,
  submitLabel,
}: {
  form: UseFormReturn<CreateStoryReplyAutomationRequest>
  onSubmit: (e: React.FormEvent) => void
  isSubmitting: boolean
  onCancel: () => void
  submitLabel: string
}) {
  const t = useTranslations()
  const flowOptions = useFlowSelectOptions()
  const aiAgents = useAIAgentStore((state) => state.aiAgents)
  const aiAgentOptions = aiAgents.map((agent) => ({
    label: agent.name,
    value: String(agent.id),
  }))
  const [selectStoriesOpen, setSelectStoriesOpen] = useState(false)
  const platform = useWatch({ control: form.control, name: "type" })
  const storyTargetType = useWatch({
    control: form.control,
    name: "storyTarget.type",
  })
  const storyTargetValue = useWatch({
    control: form.control,
    name: "storyTarget.value",
  })
  const replyType = useWatch({ control: form.control, name: "reply.type" })
  const includeKeywordsType = useWatch({
    control: form.control,
    name: "includeKeywords.type",
  })
  const replyAfterType = useWatch({
    control: form.control,
    name: "replyAfter.type",
  })
  const prevPlatformRef = useRef(platform)

  useEffect(() => {
    if (
      prevPlatformRef.current != null &&
      prevPlatformRef.current !== platform
    ) {
      form.setValue("storyTarget.value", [], { shouldValidate: true })
    }
    prevPlatformRef.current = platform
  }, [platform, form])

  const needsReplyAfterValue = ["seconds", "minutes", "hours"].includes(
    replyAfterType,
  )

  return (
    <form className="m-auto w-full max-w-200 space-y-6" onSubmit={onSubmit}>
      <InputField label={t("fields.name.label")} name="name" required />
      <Card>
        <CardHeader>
          <CardTitle>{t("storyReplyAutomation.card.targeting")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 space-y-4">
          <RadioGroupField
            label={t("storyReplyAutomation.platform")}
            name="type"
            options={[
              {
                label: t("storyReplyAutomation.platformType.messenger"),
                value: "messenger",
              },
              {
                label: t("storyReplyAutomation.platformType.instagram"),
                value: "instagram",
              },
            ]}
            orientation="horizontal"
            required
          />
          <RadioGroupField
            label={t("storyReplyAutomation.storyTarget")}
            name="storyTarget.type"
            options={[
              {
                label: t("storyReplyAutomation.storyTargetType.all"),
                value: "all",
              },
              {
                label: t("storyReplyAutomation.storyTargetType.specific"),
                value: "specific",
              },
            ]}
            orientation="horizontal"
            required
          />
          {storyTargetType === "specific" && (
            <>
              <Button
                onClick={() => setSelectStoriesOpen(true)}
                type="button"
                variant="outline"
              >
                {t("storyReplyAutomation.chooseSpecificStories")}
                {storyTargetValue.length > 0 && ` (${storyTargetValue.length})`}
              </Button>
              <SelectStoriesDialog
                onChange={(ids) =>
                  form.setValue("storyTarget.value", ids, {
                    shouldValidate: true,
                  })
                }
                onOpenChange={setSelectStoriesOpen}
                open={selectStoriesOpen}
                platform={platform}
                value={storyTargetValue}
              />
            </>
          )}
          <RadioGroupField
            label={t("storyReplyAutomation.reply")}
            name="reply.type"
            options={[
              {
                label: t("storyReplyAutomation.replyType.text"),
                value: "text",
              },
              {
                label: t("storyReplyAutomation.replyType.flow"),
                value: "flow",
              },
              {
                label: t("storyReplyAutomation.replyType.AIAgent"),
                value: "AIAgent",
              },
              {
                label: t("storyReplyAutomation.replyType.none"),
                value: "none",
              },
            ]}
            orientation="horizontal"
            required
          />
          {replyType === "text" && (
            <InputField
              label={t("storyReplyAutomation.replyMessage")}
              name="reply.value"
              placeholder={t("storyReplyAutomation.replyMessagePlaceholder")}
              required
            />
          )}
          {replyType === "flow" && (
            <ComboboxField
              emptyText={t("actions.noRecordFound")}
              label={t("fields.flow.label")}
              name="reply.value"
              options={flowOptions}
              placeholder={t("actions.pleaseSelect")}
              required
            />
          )}
          {replyType === "AIAgent" && (
            <ComboboxField
              emptyText={t("actions.noRecordFound")}
              label={t("fields.aiAgent.label")}
              name="reply.value"
              options={aiAgentOptions}
              placeholder={t("actions.pleaseSelect")}
              required
            />
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t("storyReplyAutomation.card.filters")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-2">
            <SelectField
              label={t("storyReplyAutomation.includeKeywordsType")}
              name="includeKeywords.type"
              options={[
                {
                  label: t("storyReplyAutomation.keywordsType.all"),
                  value: "all",
                },
                {
                  label: t("storyReplyAutomation.keywordsType.equal"),
                  value: "equal",
                },
                {
                  label: t("storyReplyAutomation.keywordsType.contain"),
                  value: "contain",
                },
              ]}
            />
            {includeKeywordsType !== "all" && (
              <div className="w-full">
                <FormField
                  control={form.control}
                  name="includeKeywords.value"
                  render={() => (
                    <FormItem>
                      <FormLabel>
                        {t("storyReplyAutomation.includeKeywords")}
                      </FormLabel>
                      <FormControl>
                        <TagsInputField
                          name="includeKeywords.value"
                          placeholder={t(
                            "storyReplyAutomation.keywordsPlaceholder",
                          )}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}
          </div>
          <FormField
            control={form.control}
            name="excludeKeywords"
            render={() => (
              <FormItem>
                <FormLabel>
                  {t("storyReplyAutomation.excludeKeywords")}
                </FormLabel>
                <FormControl>
                  <TagsInputField
                    name="excludeKeywords"
                    placeholder={t("storyReplyAutomation.keywordsPlaceholder")}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <SwitchField
            label={t("storyReplyAutomation.active")}
            name="isActive"
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t("storyReplyAutomation.card.replyTiming")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <SelectField
            label={t("storyReplyAutomation.replyAfter")}
            name="replyAfter.type"
            options={[
              {
                label: t("storyReplyAutomation.replyAfterType.immediately"),
                value: "immediately",
              },
              {
                label: t("storyReplyAutomation.replyAfterType.seconds"),
                value: "seconds",
              },
              {
                label: t("storyReplyAutomation.replyAfterType.minutes"),
                value: "minutes",
              },
              {
                label: t("storyReplyAutomation.replyAfterType.hours"),
                value: "hours",
              },
              {
                label: t(
                  "storyReplyAutomation.replyAfterType.randomWithin3Minutes",
                ),
                value: "randomWithin3Minutes",
              },
              {
                label: t(
                  "storyReplyAutomation.replyAfterType.randomWithin5Minutes",
                ),
                value: "randomWithin5Minutes",
              },
              {
                label: t(
                  "storyReplyAutomation.replyAfterType.randomWithin10Minutes",
                ),
                value: "randomWithin10Minutes",
              },
              {
                label: t(
                  "storyReplyAutomation.replyAfterType.randomWithin20Minutes",
                ),
                value: "randomWithin20Minutes",
              },
              {
                label: t(
                  "storyReplyAutomation.replyAfterType.randomWithin30Minutes",
                ),
                value: "randomWithin30Minutes",
              },
              {
                label: t(
                  "storyReplyAutomation.replyAfterType.randomWithin60Minutes",
                ),
                value: "randomWithin60Minutes",
              },
            ]}
            required
          />
          {needsReplyAfterValue && (
            <InputField
              label={t("storyReplyAutomation.replyAfterValue")}
              min={1}
              name="replyAfter.value"
              type="number"
            />
          )}
        </CardContent>
      </Card>
      <div className="flex justify-end gap-2">
        <Button onClick={onCancel} type="button" variant="ghost">
          {t("actions.cancel")}
        </Button>
        <Button
          disabled={!form.formState.isValid || isSubmitting}
          type="submit"
        >
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}
