import {
  aiAgentService,
  contactInboxService,
  fbCommentAutomationService,
  igStoryAutomationService,
  storyReplyAutomationService,
  withBlockedOwnerGuard,
  workspaceService,
} from "@chatbotx.io/business"
import type {
  FBCommentIncludeKeywords,
  IgStoryTarget,
  IntegrationType,
  StoryReplyAutomationIncludeKeywords,
  StoryReplyAutomationReply,
  StoryReplyAutomationReplyAfter,
  StoryReplyAutomationStoryTarget,
} from "@chatbotx.io/database/partials"
import type {
  ContactInboxModel,
  ConversationModel,
} from "@chatbotx.io/database/types"
import { webhookChannelOrigin } from "@chatbotx.io/events/context"
import {
  type InstagramAuthValue,
  sendStoryReply as sendInstagramStoryReply,
} from "@chatbotx.io/integration-instagram"
import {
  type MessengerAuthValue,
  sendStoryReply as sendMessengerStoryReply,
} from "@chatbotx.io/integration-messenger"
import { contactVariableService } from "@chatbotx.io/variables"
import {
  ChatJobAction,
  chatQueue,
  IntegrationJobAction,
  type IntegrationJobDispatchStoryReplyAutomation,
  type IntegrationJobProcessStoryReplyAutomation,
  integrationQueue,
} from "@chatbotx.io/worker-config"
import { logger } from "../../../lib/logger"
import {
  integrationService,
  isInstagramViaFacebook,
} from "../../../services/integrations"
import { generateAIReplyText } from "../automated-response/replies"

const RANDOM_DELAY_MINUTES: Record<string, number> = {
  randomWithin3Minutes: 3,
  randomWithin5Minutes: 5,
  randomWithin10Minutes: 10,
  randomWithin20Minutes: 20,
  randomWithin30Minutes: 30,
  randomWithin60Minutes: 60,
}

const STORY_REPLY_RETENTION = {
  removeOnComplete: { age: 8 * 86_400, count: 100_000 },
  removeOnFail: { age: 14 * 86_400, count: 100_000 },
}

function isLegacyProcessData(
  data: IntegrationJobProcessStoryReplyAutomation["data"],
): data is Extract<
  IntegrationJobProcessStoryReplyAutomation["data"],
  { integrationIdentifier: string }
> {
  return "integrationIdentifier" in data
}

function matchIgStory(story: IgStoryTarget, storyId: string): boolean {
  if (story.type !== "storyIds") {
    return true
  }
  return story.value.includes(storyId)
}

function matchIncludeKeywords(
  includeKeywords: FBCommentIncludeKeywords,
  message: string | undefined,
): boolean {
  if (includeKeywords.type === "all") {
    return true
  }
  const text = (message ?? "").toLowerCase()
  const keywords = includeKeywords.value.map((k) => k.toLowerCase())
  if (includeKeywords.type === "equal") {
    return keywords.includes(text)
  }
  return keywords.some((k) => text.includes(k))
}

function matchLegacyStoryTarget(
  storyTarget: StoryReplyAutomationStoryTarget,
  storyId: string,
): boolean {
  if (storyTarget.type === "all") {
    return true
  }
  return storyTarget.value.includes(storyId)
}

function matchLegacyKeywords(
  includeKeywords: StoryReplyAutomationIncludeKeywords,
  excludeKeywords: string[],
  message: string | undefined,
): boolean {
  const text = (message ?? "").toLowerCase()
  if (includeKeywords.type !== "all" && includeKeywords.value.length > 0) {
    const keywords = includeKeywords.value.map((k) => k.toLowerCase())
    if (includeKeywords.type === "equal" && !keywords.includes(text)) {
      return false
    }
    if (
      includeKeywords.type === "contain" &&
      !keywords.some((k) => text.includes(k))
    ) {
      return false
    }
  }
  if (excludeKeywords.some((k) => text.includes(k.toLowerCase()))) {
    return false
  }
  return true
}

function computeDelayMs(replyAfter: StoryReplyAutomationReplyAfter): number {
  if (replyAfter.type === "immediately") {
    return 0
  }
  if (replyAfter.type === "seconds") {
    return replyAfter.value * 1000
  }
  if (replyAfter.type === "minutes") {
    return replyAfter.value * 60_000
  }
  if (replyAfter.type === "hours") {
    return replyAfter.value * 3_600_000
  }
  const minutes =
    RANDOM_DELAY_MINUTES[replyAfter.type as keyof typeof RANDOM_DELAY_MINUTES]
  return Math.floor(Math.random() * (minutes ?? 3) * 60_000)
}

function willSendLegacyReply(reply: StoryReplyAutomationReply): boolean {
  if (reply.type === "none") {
    return false
  }
  if (reply.type === "AIAgent") {
    return true
  }
  return Boolean(reply.value)
}

export function buildStoryReplyJobId(
  automationId: string,
  mid: string,
): string {
  return `story-reply-${encodeURIComponent(automationId)}-${encodeURIComponent(mid)}`
}

async function sendUpstreamStoryReplyText(props: {
  text: string
  conversationId: string
  workspaceId: string
  contactInbox: ContactInboxModel
}): Promise<void> {
  await chatQueue.add(ChatJobAction.sendChatMessage, {
    type: ChatJobAction.sendChatMessage,
    data: {
      conversation: {
        id: props.conversationId,
        workspaceId: props.workspaceId,
      } as ConversationModel,
      contactInbox: props.contactInbox,
      text: props.text,
    },
  })
}

async function dispatchUpstreamAIAgentReply(props: {
  agentId: string
  workspaceId: string
  conversationId: string
  contactInbox: ContactInboxModel
  message: string | undefined
  onSkipped: (reason: string) => void
}): Promise<boolean> {
  const agent = await aiAgentService.findBy({
    where: { id: props.agentId, workspaceId: props.workspaceId },
  })
  if (!agent) {
    props.onSkipped("AI agent not found")
    return false
  }

  const generated = await generateAIReplyText({
    conversation: {
      id: props.conversationId,
      workspaceId: props.workspaceId,
      contactId: props.contactInbox.contactId,
    } as ConversationModel,
    contactInbox: props.contactInbox,
    messages: [{ role: "user", content: props.message ?? "" }],
    aiAgent: agent,
  })
  if (!generated?.text) {
    props.onSkipped("AI agent produced no text")
    return false
  }

  await sendUpstreamStoryReplyText({
    text: generated.text,
    conversationId: props.conversationId,
    workspaceId: props.workspaceId,
    contactInbox: props.contactInbox,
  })
  return true
}

const logUpstreamAutomationSkipped = ({
  automationId,
  messageId,
  storyId,
  workspaceId,
  reason,
}: {
  automationId: string
  messageId: string
  storyId: string
  workspaceId: string
  reason: string
}) => {
  logger.info(
    { automationId, messageId, storyId, workspaceId, reason },
    "Story reply automation skipped",
  )
}

const logLegacyAutomationSkipped = ({
  automationId,
  mid,
  storyId,
  workspaceId,
  reason,
}: {
  automationId: string
  mid: string
  storyId?: string
  workspaceId: string
  reason: string
}) => {
  logger.info(
    { automationId, mid, storyId, workspaceId, reason },
    "Legacy story reply automation skipped",
  )
}

async function executeLegacyReply(
  reply: StoryReplyAutomationReply,
  ctx: {
    automationId: string
    mid: string
    channelType: "messenger" | "instagram"
    conversationId: string
    contactInboxId: string
    psid: string
    delay: number
    integrationIdentifier: string
    workspaceId: string
  },
) {
  if (reply.type === "none") {
    return
  }

  const jobId = buildStoryReplyJobId(ctx.automationId, ctx.mid)

  if (reply.type === "text" && reply.value) {
    await integrationQueue.add(
      IntegrationJobAction.dispatchStoryReplyAutomation,
      {
        type: IntegrationJobAction.dispatchStoryReplyAutomation,
        data: {
          integrationType: ctx.channelType,
          integrationIdentifier: ctx.integrationIdentifier,
          automationId: ctx.automationId,
          mid: ctx.mid,
          psid: ctx.psid,
          text: reply.value,
          workspaceId: ctx.workspaceId,
        },
      },
      { delay: ctx.delay, jobId, ...STORY_REPLY_RETENTION },
    )
    return
  }

  if (reply.type === "flow" && reply.value) {
    await integrationQueue.add(
      IntegrationJobAction.sendFlow,
      {
        type: IntegrationJobAction.sendFlow,
        data: {
          conversationId: ctx.conversationId,
          contactInboxId: ctx.contactInboxId,
          flowId: reply.value,
          origin: webhookChannelOrigin(),
        },
      },
      { delay: ctx.delay, jobId, ...STORY_REPLY_RETENTION },
    )
    return
  }

  if (reply.type === "AIAgent") {
    await integrationQueue.add(
      IntegrationJobAction.sendFlow,
      {
        type: IntegrationJobAction.sendFlow,
        data: {
          conversationId: ctx.conversationId,
          contactInboxId: ctx.contactInboxId,
          origin: webhookChannelOrigin(),
        },
      },
      { delay: ctx.delay, jobId, ...STORY_REPLY_RETENTION },
    )
  }
}

async function processLegacyStoryReplyAutomation(
  data: Extract<
    IntegrationJobProcessStoryReplyAutomation["data"],
    { integrationIdentifier: string }
  >,
): Promise<void> {
  await withBlockedOwnerGuard(data.workspaceId, async () => {
    const {
      integrationType,
      integrationIdentifier,
      workspaceId,
      conversationId,
      contactInboxId,
      psid,
      storyId,
      mid,
      message,
    } = data

    const { integrationRow } =
      await integrationService.identifyInboxAndIntegrationAuthFromIdentifier(
        integrationType as IntegrationType,
        integrationIdentifier,
      )

    if (
      integrationType === "instagram" &&
      isInstagramViaFacebook(integrationRow)
    ) {
      logger.info(
        { workspaceId, mid },
        "Legacy story reply automation skipped: instagram-via-facebook integrations are not supported",
      )
      return
    }

    const automations = await storyReplyAutomationService.findActiveAutomations(
      {
        workspaceId,
        channelType: integrationType,
      },
    )
    if (automations.length === 0) {
      return
    }

    const workspace = await workspaceService.findById({ id: workspaceId })
    let processingFailed = false

    for (const automation of automations) {
      try {
        if (
          !storyReplyAutomationService.isWithinSchedule(
            automation,
            workspace.timezone,
          )
        ) {
          logLegacyAutomationSkipped({
            automationId: automation.id,
            mid,
            storyId,
            workspaceId,
            reason: "outside schedule",
          })
          continue
        }

        if (!matchLegacyStoryTarget(automation.storyTarget, storyId)) {
          logLegacyAutomationSkipped({
            automationId: automation.id,
            mid,
            storyId,
            workspaceId,
            reason: "story does not match",
          })
          continue
        }

        if (
          !matchLegacyKeywords(
            automation.includeKeywords,
            automation.excludeKeywords,
            message,
          )
        ) {
          logLegacyAutomationSkipped({
            automationId: automation.id,
            mid,
            storyId,
            workspaceId,
            reason: "keywords do not match",
          })
          continue
        }

        const dispatch = await storyReplyAutomationService.getOrCreateDispatch({
          automationId: automation.id,
          storyReplyMessageId: mid,
          workspaceId,
        })
        if (dispatch.scheduledAt) {
          logLegacyAutomationSkipped({
            automationId: automation.id,
            mid,
            storyId,
            workspaceId,
            reason: "story reply dispatch already scheduled",
          })
          continue
        }

        const delay = computeDelayMs(automation.replyAfter)
        await executeLegacyReply(automation.reply, {
          automationId: automation.id,
          mid,
          channelType: integrationType,
          conversationId,
          contactInboxId,
          psid,
          delay,
          integrationIdentifier,
          workspaceId,
        })

        const marked = await storyReplyAutomationService.markDispatchScheduled({
          automationId: automation.id,
          storyReplyMessageId: mid,
          workspaceId,
          hasReply: willSendLegacyReply(automation.reply),
        })

        if (!marked) {
          logLegacyAutomationSkipped({
            automationId: automation.id,
            mid,
            storyId,
            workspaceId,
            reason: "story reply dispatch was already claimed",
          })
        }
      } catch (err) {
        processingFailed = true
        logger.error(
          { err, automationId: automation.id, mid, workspaceId },
          "Failed to process legacy story reply automation",
        )
      }
    }

    if (processingFailed) {
      throw new Error(
        "One or more legacy story reply automations failed to process",
      )
    }
  })
}

async function processUpstreamStoryReplyAutomation(
  data: Exclude<
    IntegrationJobProcessStoryReplyAutomation["data"],
    { integrationIdentifier: string }
  >,
): Promise<void> {
  const {
    workspaceId,
    conversationId,
    contactInboxId,
    messageId,
    storyId,
    message,
    channelType,
  } = data

  const contactInbox = await contactInboxService.findBy({
    where: { id: contactInboxId },
  })
  if (!contactInbox) {
    logger.warn(
      { contactInboxId, workspaceId, messageId },
      "Story reply automation skipped: contactInbox not found",
    )
    return
  }

  const [automations, workspace] = await Promise.all([
    igStoryAutomationService.findActiveAutomations({
      workspaceId,
      channelType,
    }),
    workspaceService.findById({ id: workspaceId }),
  ])

  for (const automation of automations) {
    try {
      if (
        !fbCommentAutomationService.isWithinSchedule(
          automation,
          workspace.timezone,
        )
      ) {
        logUpstreamAutomationSkipped({
          automationId: automation.id,
          messageId,
          storyId,
          workspaceId,
          reason: "outside schedule",
        })
        continue
      }

      if (!matchIgStory(automation.story, storyId)) {
        logUpstreamAutomationSkipped({
          automationId: automation.id,
          messageId,
          storyId,
          workspaceId,
          reason: "story does not match",
        })
        continue
      }

      if (!matchIncludeKeywords(automation.includeKeywords, message)) {
        logUpstreamAutomationSkipped({
          automationId: automation.id,
          messageId,
          storyId,
          workspaceId,
          reason: "keywords do not match",
        })
        continue
      }

      const reply = automation.reply
      let dispatched = false

      if (reply.type === "text" && reply.value) {
        let text = reply.value
        try {
          const variables = await contactVariableService.getAll({
            contactId: contactInbox.contactId,
            contactInbox,
          })
          text = await contactVariableService.replaceAll({
            text: reply.value,
            variables,
          })
        } catch (err) {
          logger.warn(
            { err, messageId, storyId },
            "Failed to resolve variables in reply text, sending raw text",
          )
        }
        await sendUpstreamStoryReplyText({
          text,
          conversationId,
          workspaceId,
          contactInbox,
        })
        dispatched = true
      } else if (reply.type === "flow" && reply.value) {
        await integrationQueue.add(IntegrationJobAction.sendFlow, {
          type: IntegrationJobAction.sendFlow,
          data: {
            conversationId,
            contactInboxId,
            flowId: reply.value,
            origin: webhookChannelOrigin(),
          },
        })
        dispatched = true
      } else if (reply.type === "AIAgent" && reply.value) {
        dispatched = await dispatchUpstreamAIAgentReply({
          agentId: reply.value,
          workspaceId,
          conversationId,
          contactInbox,
          message,
          onSkipped: (reason) =>
            logUpstreamAutomationSkipped({
              automationId: automation.id,
              messageId,
              storyId,
              workspaceId,
              reason,
            }),
        })
      }

      if (dispatched) {
        await igStoryAutomationService.incrementRepliesCount(automation.id)
      }
    } catch (err) {
      logger.error(
        { err, automationId: automation.id, messageId, workspaceId },
        "Failed to process story reply automation",
      )
    }
  }
}

export async function processStoryReplyAutomation(
  data: IntegrationJobProcessStoryReplyAutomation["data"],
): Promise<void> {
  if (isLegacyProcessData(data)) {
    await processLegacyStoryReplyAutomation(data)
    return
  }

  await processUpstreamStoryReplyAutomation(data)
}

export async function dispatchStoryReplyAutomation(
  data: IntegrationJobDispatchStoryReplyAutomation["data"],
): Promise<void> {
  await withBlockedOwnerGuard(data.workspaceId, async () => {
    const { integrationRow } =
      await integrationService.identifyInboxAndIntegrationAuthFromIdentifier(
        data.integrationType as IntegrationType,
        data.integrationIdentifier,
      )

    const claim = await storyReplyAutomationService.claimReplySend({
      automationId: data.automationId,
      storyReplyMessageId: data.mid,
      workspaceId: data.workspaceId,
    })

    if (claim !== "claimed") {
      logLegacyAutomationSkipped({
        automationId: data.automationId,
        mid: data.mid,
        workspaceId: data.workspaceId,
        reason: "private reply already sent",
      })
      return
    }

    if (data.integrationType === "messenger") {
      await sendMessengerStoryReply(
        integrationRow.auth as MessengerAuthValue,
        data.psid,
        data.text,
      )
      return
    }

    await sendInstagramStoryReply(
      integrationRow.auth as InstagramAuthValue,
      data.psid,
      data.text,
    )
  })
}
