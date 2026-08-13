"use client"

import {
  type ThreadsCredentialPublic,
  type ThreadsCredentialUpdate,
  threadsCredentialUpdateSchema,
} from "@chatbotx.io/database/partials"
import { InputField } from "@chatbotx.io/ui/components/form/input-field"
import { Button } from "@chatbotx.io/ui/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@chatbotx.io/ui/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@chatbotx.io/ui/components/ui/dialog"
import { Form } from "@chatbotx.io/ui/components/ui/form"
import { zodResolver } from "@hookform/resolvers/zod"
import { SiThreads, SiThreadsHex } from "@icons-pack/react-simple-icons"
import { useHookFormAction } from "@next-safe-action/adapter-react-hook-form/hooks"
import { CopyIcon, Loader2Icon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { toast } from "sonner"
import { buildThreadsWebhookUrl } from "@/features/integration-threads/libs/oauth"
import { useClipboard } from "@/hooks/use-clipboard"
import { buildBrokerCallbackUrl } from "@/lib/oauth-broker"
import { CredentialFallbackNote } from "../credential-fallback-note"
import { useCredentialScope } from "../provider/credential-scope-context"
import { updateThreadsSettingAction } from "./update-threads-settings.action"

export function ThreadsSettings({
  publicConfig,
  isInherited = false,
}: {
  publicConfig: ThreadsCredentialPublic | null
  isInherited?: boolean
}) {
  const t = useTranslations()
  const { handleCopy } = useClipboard()
  const authCallbackUrl = buildBrokerCallbackUrl(
    "/integrations/threads/callback",
  )
  const webhookUrl = publicConfig?.clientId
    ? buildThreadsWebhookUrl(publicConfig.clientId)
    : null

  return (
    <Card>
      <CardHeader className="items-center justify-center">
        <CardTitle className="flex items-center gap-2">
          <SiThreads className="size-6" fill={SiThreadsHex} />
          <span>{t("fields.threads.label")}</span>
        </CardTitle>
        <CardAction>
          <EditThreadsSettingsDialog
            isInherited={isInherited}
            publicConfig={publicConfig}
          />
        </CardAction>
      </CardHeader>
      <CardContent>
        {publicConfig?.clientId ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col">
              <div className="font-bold">{t("fields.appId.label")}:</div>
              <div className="flex items-center gap-2">
                <span className="truncate">{publicConfig.clientId}</span>
                <Button
                  aria-label={t("actions.copy")}
                  className="flex-none"
                  onClick={() => handleCopy(publicConfig.clientId)}
                  size="icon"
                  type="button"
                  variant="outline"
                >
                  <CopyIcon className="size-4" />
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="font-bold">
                {t("fields.authCallbackUrl.label")}:
              </div>
              <div className="flex items-center gap-2">
                <span className="truncate">{authCallbackUrl}</span>
                <Button
                  aria-label={t("actions.copy")}
                  className="flex-none"
                  onClick={() => handleCopy(authCallbackUrl)}
                  size="icon"
                  type="button"
                  variant="outline"
                >
                  <CopyIcon className="size-4" />
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="font-bold">{t("fields.webhookUrl.label")}:</div>
              <div className="flex items-center gap-2">
                {webhookUrl ? (
                  <>
                    <span className="truncate">{webhookUrl}</span>
                    <Button
                      aria-label={t("actions.copy")}
                      className="flex-none"
                      onClick={() => handleCopy(webhookUrl)}
                      size="icon"
                      type="button"
                      variant="outline"
                    >
                      <CopyIcon className="size-4" />
                    </Button>
                  </>
                ) : null}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="font-bold">
                {t("fields.webhookVerifyToken.label")}:
              </div>
              <div className="flex items-center gap-2">
                <span className="truncate">{publicConfig.verifyToken}</span>
                <Button
                  aria-label={t("actions.copy")}
                  className="flex-none"
                  onClick={() => handleCopy(publicConfig.verifyToken)}
                  size="icon"
                  type="button"
                  variant="outline"
                >
                  <CopyIcon className="size-4" />
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <CredentialFallbackNote isInherited={isInherited} />
        )}
      </CardContent>
    </Card>
  )
}

function EditThreadsSettingsDialog({
  isInherited,
  publicConfig,
}: {
  isInherited: boolean
  publicConfig: ThreadsCredentialPublic | null
}) {
  const t = useTranslations()
  const [open, setOpen] = useState(false)
  const router = useRouter()

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger render={<Button size="sm" type="button" />}>
        {t("actions.edit")}
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>
          {t("messages.editFeature", { feature: t("fields.threads.label") })}
        </DialogTitle>
        <EditThreadsSettingsForm
          isInherited={isInherited}
          onClose={() => {
            setOpen(false)
            router.refresh()
          }}
          publicConfig={publicConfig}
        />
      </DialogContent>
    </Dialog>
  )
}

function EditThreadsSettingsForm({
  isInherited,
  publicConfig,
  onClose,
}: {
  isInherited: boolean
  publicConfig: ThreadsCredentialPublic | null
  onClose?: () => void
}) {
  const t = useTranslations()
  const scope = useCredentialScope()

  const { form, handleSubmitWithAction, resetFormAndAction } =
    useHookFormAction(
      updateThreadsSettingAction.bind(null, scope),
      zodResolver(threadsCredentialUpdateSchema),
      {
        actionProps: {
          onSuccess: () => onClose?.(),
          onError: ({ error }) => {
            if (error.serverError) {
              toast.error(error.serverError)
            }
          },
        },
        formProps: {
          mode: "onChange",
          defaultValues: {
            clientId: publicConfig?.clientId ?? "",
            version: publicConfig?.version ?? "v1.0",
            verifyToken: publicConfig?.verifyToken ?? "",
            clientSecret: "",
          } satisfies ThreadsCredentialUpdate,
        },
      },
    )

  const isConfigured = publicConfig !== null && !isInherited

  return (
    <Form {...form}>
      <form className="flex flex-col gap-4" onSubmit={handleSubmitWithAction}>
        <InputField label={t("fields.appId.label")} name="clientId" required />
        <InputField
          description={
            isConfigured ? t("messages.leaveEmptyToKeepSecret") : undefined
          }
          label={t("fields.appSecret.label")}
          name="clientSecret"
          required={!isConfigured}
          type="password"
        />
        <InputField
          label={t("fields.webhookVerifyToken.label")}
          name="verifyToken"
          required
        />
        <InputField
          label={t("fields.apiVersion.label")}
          name="version"
          required
        />
        <div className="flex justify-end gap-2">
          <Button
            onClick={() => {
              resetFormAndAction()
              onClose?.()
            }}
            type="button"
            variant="outline"
          >
            {t("actions.cancel")}
          </Button>
          <Button
            disabled={!form.formState.isValid || form.formState.isSubmitting}
            type="submit"
          >
            {form.formState.isSubmitting && (
              <Loader2Icon className="size-4 animate-spin" />
            )}
            {t("actions.save")}
          </Button>
        </div>
      </form>
    </Form>
  )
}
