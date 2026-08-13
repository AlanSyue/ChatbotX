import {
  broadcastToWorkspaceParty,
  contactInboxService,
  fbCommentAutomationService,
  withBlockedOwnerGuard,
  workspaceService,
} from "@chatbotx.io/business"
import type {
  FBCommentHideComments,
  FBCommentIncludeKeywords,
  FBCommentPost,
  FBCommentPublicReply,
  FBCommentReply,
  FBCommentReplyAfter,
  IntegrationType,
} from "@chatbotx.io/database/partials"
import { createMessageRepository } from "@chatbotx.io/database/repositories"
import type {
  ContactInboxModel,
  ConversationModel,
} from "@chatbotx.io/database/types"
import { webhookChannelOrigin } from "@chatbotx.io/events/context"
import {
  type InstagramAuthValue,
  sendPrivateReply as sendInstagramLoginPrivateReply,
} from "@chatbotx.io/integration-instagram"
import {
  type InstagramAuthValue as InstagramFacebookAuthValue,
  sendPrivateReply as sendInstagramFacebookPrivateReply,
} from "@chatbotx.io/integration-instagram-facebook"
import {
  type MessengerAuthValue,
  sendPrivateReply,
} from "@chatbotx.io/integration-messenger"
import { RealtimeEventType } from "@chatbotx.io/partysocket-config"
import { createId } from "@chatbotx.io/utils"
import { contactVariableService } from "@chatbotx.io/variables"
import {
  ChatJobAction,
  type ChatJobSendChannelMessage,
  chatQueue,
  IntegrationJobAction,
  type IntegrationJobDispatchCommentAutomationPrivateReply,
  type IntegrationJobProcessCommentAutomation,
  integrationQueue,
} from "@chatbotx.io/worker-config"
import { logger } from "../../../lib/logger"
import { integrationService } from "../../../services/integrations"
import {
  createAttachmentInfoResolver,
  needsAttachmentInfo,
} from "./comment-attachment"
import {
  getPublicReplyValues,
  selectPublicReplyText,
} from "./public-reply-text"

const RANDOM_DELAY_MINUTES: Record<string, number> = {
  randomWithin3Minutes: 3,
  randomWithin5Minutes: 5,
  randomWithin10Minutes: 10,
  randomWithin20Minutes: 20,
  randomWithin30Minutes: 30,
  randomWithin60Minutes: 60,
}

const PHONE_RE = /\+?\d[\d\s\-().]{7,}/
const SCHEME_LINK_RE = /https?:\/\/|www\./i
const BARE_DOMAIN_RE =
  /\b[a-z0-9-]+\.(?:com|net|org|io|vn|shop|store|info|biz)\b/

function hasLink(text: string): boolean {
  return SCHEME_LINK_RE.test(text) || BARE_DOMAIN_RE.test(text)
}

const UNHIDE_DELAY_MS: Record<string, number> = {
  "6h": 6 * 3_600_000,
  "12h": 12 * 3_600_000,
  "1d": 86_400_000,
  "2d": 2 * 86_400_000,
  "3d": 3 * 86_400_000,
  "4d": 4 * 86_400_000,
  "5d": 5 * 86_400_000,
  "6d": 6 * 86_400_000,
  "7d": 7 * 86_400_000,
  "8d": 8 * 86_400_000,
  "9d": 9 * 86_400_000,
  "10d": 10 * 86_400_000,
}

function getThreadsAuthUsername(auth: unknown): string | undefined {
  const username =
    typeof auth === "object" &&
    auth !== null &&
    "metadata" in auth &&
    typeof auth.metadata === "object" &&
    auth.metadata !== null &&
    "username" in auth.metadata &&
    typeof auth.metadata.username === "string"
      ? auth.metadata.username
      : undefined

  return username?.toLowerCase()
}

const COMMENT_REPLY_RETENTION = {
  removeOnComplete: { age: 8 * 86_400, count: 100_000 },
  removeOnFail: { age: 14 * 86_400, count: 100_000 },
}

function normalizePostId(id: string): string {
  const idx = id.indexOf("_")
  return idx === -1 ? id : id.slice(idx + 1)
}

function matchPost(post: FBCommentPost, postId: string): boolean {
  if (post.type !== "postIds") {
    return true
  }
  const target = normalizePostId(postId)
  return post.value.some((v) => v === postId || normalizePostId(v) === target)
}

function matchKeywords(
  includeKeywords: FBCommentIncludeKeywords,
  excludeKeywords: string[],
  message: string | undefined,
): boolean {
  const text = (message ?? "").toLowerCase()
  if (includeKeywords.type !== "all" && includeKeywords.value.length > 0) {
    const kws = includeKeywords.value.map((k) => k.toLowerCase())
    if (includeKeywords.type === "equal" && !kws.includes(text)) {
      return false
    }
    if (
      includeKeywords.type === "contain" &&
      !kws.some((k) => text.includes(k))
    ) {
      return false
    }
  }
  if (excludeKeywords.some((k) => text.includes(k.toLowerCase()))) {
    return false
  }
  return true
}

export function isCommentReply(
  parentId: string | undefined,
  postId: string,
): boolean {
  return Boolean(parentId) && parentId !== postId
}

function willSendReply(reply: FBCommentReply): boolean {
  if (reply.type === "none") {
    return false
  }
  return Boolean(reply.value)
}

function willSendPublicReply(reply: FBCommentPublicReply): boolean {
  if (reply.type === "none") {
    return false
  }
  if (reply.type === "text") {
    return getPublicReplyValues(reply).length > 0
  }
  return Boolean(reply.value)
}

function computeDelayMs(replyAfter: FBCommentReplyAfter): number {
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

export function buildCommentReplyJobId(
  kind: "public" | "private",
  automationId: string,
  commentId: string,
): string {
  return `comment-reply-${kind}-${encodeURIComponent(automationId)}-${encodeURIComponent(commentId)}`
}

export async function postPublicCommentReply(props: {
  automationId: string
  text: string
  commentId: string
  conversationId: string
  contactInboxId: string
  workspaceId: string
  contactInbox: ContactInboxModel
  parentMessageId?: string | null
  parentMessageCreatedAt?: Date | null
  delay?: number
}): Promise<void> {
  const repo = await createMessageRepository()
  const reservation = await fbCommentAutomationService.reservePublicMessage({
    automationId: props.automationId,
    commentId: props.commentId,
    workspaceId: props.workspaceId,
    messageId: createId(),
    messageCreatedAt: new Date(),
  })
  const messageInput = {
    id: reservation.messageId,
    conversationId: props.conversationId,
    contactInboxId: props.contactInboxId,
    workspaceId: props.workspaceId,
    messageType: "outgoing" as const,
    contentType: "text" as const,
    senderType: "bot" as const,
    text: props.text,
    type: "comment" as const,
    contentAttributes: { replyToCommentId: props.commentId },
    parentId: props.parentMessageId ?? null,
    createdAt: reservation.messageCreatedAt,
  }
  let message = await repo.findById({
    id: reservation.messageId,
    createdAt: reservation.messageCreatedAt,
    workspaceId: props.workspaceId,
  })
  let isNew = false
  if (!message) {
    try {
      const created = await repo.create(messageInput)
      message = (await repo.findById({
        id: created.id,
        createdAt: created.createdAt,
        workspaceId: props.workspaceId,
      })) ?? {
        ...created,
        attachments: [],
      }
      isNew = true
    } catch (err) {
      message = await repo.findById({
        id: reservation.messageId,
        createdAt: reservation.messageCreatedAt,
        workspaceId: props.workspaceId,
      })
      if (!message) {
        throw err
      }
    }
  }
  if (isNew) {
    broadcastToWorkspaceParty(props.workspaceId, {
      eventType: RealtimeEventType.messageCreated,
      data: message,
    }).catch((err: unknown) =>
      logger.error(
        { err, commentId: props.commentId },
        "Unable to emit realtime message",
      ),
    )
  }
  await chatQueue.add(
    ChatJobAction.sendChannelMessage,
    {
      type: ChatJobAction.sendChannelMessage,
      data: {
        conversation: {
          id: props.conversationId,
          workspaceId: props.workspaceId,
        } as ConversationModel,
        contactInbox: props.contactInbox,
        message: {
          ...message,
          parentCreatedAt: props.parentMessageCreatedAt ?? null,
        } satisfies ChatJobSendChannelMessage["data"]["message"],
      },
    },
    {
      ...(props.delay === undefined ? {} : { delay: props.delay }),
      jobId: buildCommentReplyJobId(
        "public",
        props.automationId,
        props.commentId,
      ),
      ...COMMENT_REPLY_RETENTION,
    },
  )
}

async function executePublicReply(
  publicReplyInput: FBCommentPublicReply,
  ctx: {
    automationId: string
    integrationType: string
    integrationIdentifier: string
    commentId: string
    channelType: "messenger" | "instagram" | "instagramFacebook" | "threads"
    conversationId: string
    contactInboxId: string
    delay: number
    workspaceId: string
    contactInbox: ContactInboxModel
    message?: string
    parentMessageId?: string | null
    parentMessageCreatedAt?: Date | null
  },
) {
  if (publicReplyInput.type === "none") {
    return
  }

  if (
    ctx.channelType === "threads" &&
    !["text", "none"].includes(publicReplyInput.type)
  ) {
    logger.info(
      { automationId: ctx.automationId, commentId: ctx.commentId },
      "Threads comment automation skipped unsupported public reply",
    )
    return
  }

  const nonThreadsChannelType =
    ctx.channelType === "threads" ? undefined : ctx.channelType

  if (publicReplyInput.type === "text") {
    let text = selectPublicReplyText({
      automationId: ctx.automationId,
      commentId: ctx.commentId,
      reply: publicReplyInput,
    })
    if (!text) {
      return
    }
    try {
      const variables = await contactVariableService.getAll({
        contactId: ctx.contactInbox.contactId,
        contactInbox: ctx.contactInbox,
      })
      text = await contactVariableService.replaceAll({
        text,
        variables,
      })
    } catch (err) {
      logger.warn(
        { err, commentId: ctx.commentId },
        "Failed to resolve variables in reply text, sending raw text",
      )
    }
    await postPublicCommentReply({
      automationId: ctx.automationId,
      text,
      commentId: ctx.commentId,
      conversationId: ctx.conversationId,
      contactInboxId: ctx.contactInboxId,
      workspaceId: ctx.workspaceId,
      contactInbox: ctx.contactInbox,
      parentMessageId: ctx.parentMessageId,
      parentMessageCreatedAt: ctx.parentMessageCreatedAt,
      delay: ctx.delay,
    })
    return
  }

  if (publicReplyInput.type === "flow" && publicReplyInput.value) {
    if (!nonThreadsChannelType) {
      return
    }
    await integrationQueue.add(
      IntegrationJobAction.sendFlow,
      {
        type: IntegrationJobAction.sendFlow,
        data: {
          conversationId: ctx.conversationId,
          contactInboxId: ctx.contactInboxId,
          flowId: publicReplyInput.value,
          origin: webhookChannelOrigin(),
          commentAnchor: { commentId: ctx.commentId, replyChannel: "public" },
        },
      },
      {
        delay: ctx.delay,
        jobId: buildCommentReplyJobId(
          "public",
          ctx.automationId,
          ctx.commentId,
        ),
        ...COMMENT_REPLY_RETENTION,
      },
    )
    return
  }

  if (publicReplyInput.type === "AIAgent" && publicReplyInput.value) {
    if (!nonThreadsChannelType) {
      return
    }
    await integrationQueue.add(
      IntegrationJobAction.commentAIReply,
      {
        type: IntegrationJobAction.commentAIReply,
        data: {
          automationId: ctx.automationId,
          integrationType: ctx.integrationType,
          integrationIdentifier: ctx.integrationIdentifier,
          workspaceId: ctx.workspaceId,
          conversationId: ctx.conversationId,
          contactInboxId: ctx.contactInboxId,
          commentId: ctx.commentId,
          agentId: publicReplyInput.value,
          replyChannel: "public",
          channelType: nonThreadsChannelType,
          message: ctx.message,
          parentMessageId: ctx.parentMessageId ?? null,
          parentMessageCreatedAt:
            ctx.parentMessageCreatedAt?.toISOString() ?? null,
        },
      },
      {
        delay: ctx.delay,
        jobId: buildCommentReplyJobId(
          "public",
          ctx.automationId,
          ctx.commentId,
        ),
        ...COMMENT_REPLY_RETENTION,
      },
    )
  }
}

async function executePrivateReply(
  privateReply: FBCommentReply,
  ctx: {
    automationId: string
    integrationType: string
    integrationIdentifier: string
    commentId: string
    channelType: "messenger" | "instagram" | "instagramFacebook" | "threads"
    conversationId: string
    contactInboxId: string
    contactInbox: ContactInboxModel
    workspaceId: string
    delay: number
    message?: string
  },
) {
  if (ctx.channelType === "threads") {
    if (privateReply.type !== "none") {
      logger.info(
        { automationId: ctx.automationId, commentId: ctx.commentId },
        "Threads comment automation skipped unsupported private reply",
      )
    }
    return
  }

  if (privateReply.type === "none") {
    return
  }

  if (privateReply.type === "text" && privateReply.value) {
    let text = privateReply.value
    try {
      const variables = await contactVariableService.getAll({
        contactId: ctx.contactInbox.contactId,
        contactInbox: ctx.contactInbox,
      })
      text = await contactVariableService.replaceAll({
        text: privateReply.value,
        variables,
      })
    } catch (err) {
      logger.warn(
        { err, commentId: ctx.commentId },
        "Failed to resolve variables in reply text, sending raw text",
      )
    }

    await integrationQueue.add(
      IntegrationJobAction.dispatchCommentAutomationPrivateReply,
      {
        type: IntegrationJobAction.dispatchCommentAutomationPrivateReply,
        data: {
          integrationType: ctx.channelType,
          integrationIdentifier: ctx.integrationIdentifier,
          automationId: ctx.automationId,
          commentId: ctx.commentId,
          text,
          workspaceId: ctx.workspaceId,
        },
      },
      {
        delay: ctx.delay,
        jobId: buildCommentReplyJobId(
          "private",
          ctx.automationId,
          ctx.commentId,
        ),
        ...COMMENT_REPLY_RETENTION,
      },
    )
    return
  }

  if (privateReply.type === "flow" && privateReply.value) {
    await integrationQueue.add(
      IntegrationJobAction.sendFlow,
      {
        type: IntegrationJobAction.sendFlow,
        data: {
          conversationId: ctx.conversationId,
          contactInboxId: ctx.contactInboxId,
          flowId: privateReply.value,
          origin: webhookChannelOrigin(),
          ...(ctx.channelType === "messenger"
            ? {
                commentAnchor: {
                  commentId: ctx.commentId,
                  replyChannel: "private" as const,
                },
              }
            : {}),
        },
      },
      {
        delay: ctx.delay,
        jobId: buildCommentReplyJobId(
          "private",
          ctx.automationId,
          ctx.commentId,
        ),
        ...COMMENT_REPLY_RETENTION,
      },
    )
    return
  }

  if (privateReply.type === "AIAgent" && privateReply.value) {
    await integrationQueue.add(
      IntegrationJobAction.commentAIReply,
      {
        type: IntegrationJobAction.commentAIReply,
        data: {
          automationId: ctx.automationId,
          integrationType: ctx.integrationType,
          integrationIdentifier: ctx.integrationIdentifier,
          workspaceId: ctx.workspaceId,
          conversationId: ctx.conversationId,
          contactInboxId: ctx.contactInboxId,
          commentId: ctx.commentId,
          agentId: privateReply.value,
          replyChannel: "private",
          channelType: ctx.channelType,
          message: ctx.message,
        },
      },
      {
        delay: ctx.delay,
        jobId: buildCommentReplyJobId(
          "private",
          ctx.automationId,
          ctx.commentId,
        ),
        ...COMMENT_REPLY_RETENTION,
      },
    )
  }
}

export async function dispatchCommentAutomationPrivateReply(
  data: IntegrationJobDispatchCommentAutomationPrivateReply["data"],
): Promise<void> {
  const claim = await fbCommentAutomationService.claimPrivateReplySend({
    automationId: data.automationId,
    commentId: data.commentId,
    workspaceId: data.workspaceId,
  })
  if (claim === "already-sent") {
    logger.warn(
      { automationId: data.automationId, commentId: data.commentId },
      "Private reply already sent for this comment, skipping duplicate dispatch attempt",
    )
    return
  }

  const { integrationRow } =
    await integrationService.identifyInboxAndIntegrationAuthFromIdentifier(
      data.integrationType as IntegrationType,
      data.integrationIdentifier,
    )

  if (data.integrationType === "messenger") {
    await sendPrivateReply(
      integrationRow.auth as MessengerAuthValue,
      data.commentId,
      data.text,
    )
    return
  }

  if (data.integrationType === "instagramFacebook") {
    await sendInstagramFacebookPrivateReply(
      integrationRow.auth as InstagramFacebookAuthValue,
      data.commentId,
      data.text,
    )
    return
  }

  await sendInstagramLoginPrivateReply(
    integrationRow.auth as InstagramAuthValue,
    data.commentId,
    data.text,
  )
}

async function applyHideComments(
  hideComments: FBCommentHideComments,
  commentId: string,
  message: string | undefined,
  ctx: {
    conversation: ConversationModel
    contactInbox: ContactInboxModel
    messageId: string
    messageCreatedAt: Date
    hasImage: boolean
    hasVideo: boolean
  },
) {
  const text = message ?? ""
  const lowerText = text.toLowerCase()

  const shouldHide =
    hideComments.all ||
    (hideComments.hasPhoneNumber && PHONE_RE.test(text)) ||
    (hideComments.hasLink && hasLink(text)) ||
    (hideComments.hasKeywords &&
      hideComments.keywords.some((k) => lowerText.includes(k.toLowerCase()))) ||
    (hideComments.hasImage && ctx.hasImage) ||
    (hideComments.hasVideo && ctx.hasVideo)

  if (!shouldHide) {
    return
  }

  await chatQueue.add(ChatJobAction.changeChannelMessageState, {
    type: ChatJobAction.changeChannelMessageState,
    data: {
      conversation: ctx.conversation,
      contactInbox: ctx.contactInbox,
      message: { id: ctx.messageId, createdAt: ctx.messageCreatedAt },
      hidden: true,
    },
  })

  if (hideComments.showCommentsAfter !== "none") {
    const delay = UNHIDE_DELAY_MS[hideComments.showCommentsAfter] ?? 0
    await chatQueue.add(
      ChatJobAction.changeChannelMessageState,
      {
        type: ChatJobAction.changeChannelMessageState,
        data: {
          conversation: ctx.conversation,
          contactInbox: ctx.contactInbox,
          message: { id: ctx.messageId, createdAt: ctx.messageCreatedAt },
          hidden: false,
        },
      },
      { delay, jobId: `unhide-comment-${commentId}` },
    )
  }
}

export async function processCommentAutomation(
  data: IntegrationJobProcessCommentAutomation["data"],
): Promise<void> {
  await withBlockedOwnerGuard(data.workspaceId, async () => {
    const {
      integrationType,
      integrationIdentifier,
      workspaceId,
      conversationId,
      contactInboxId,
      commentId,
      postId,
      parentId,
      fromId: _fromId,
      message,
      createdTime,
    } = data

    const { integrationRow } =
      await integrationService.identifyInboxAndIntegrationAuthFromIdentifier(
        integrationType as IntegrationType,
        integrationIdentifier,
      )
    const auth = integrationRow.auth as MessengerAuthValue

    const contactInbox = await contactInboxService.findBy({
      where: { id: contactInboxId },
    })
    if (!contactInbox) {
      logger.warn(
        { contactInboxId, workspaceId, commentId },
        "Comment automation skipped: contactInbox not found",
      )
      return
    }

    const channelType = integrationType as
      | "messenger"
      | "instagram"
      | "instagramFacebook"
      | "threads"
    const selfThreadsUsername =
      channelType === "threads"
        ? getThreadsAuthUsername(integrationRow.auth)
        : undefined

    if (
      channelType === "threads" &&
      typeof data.fromId === "string" &&
      selfThreadsUsername &&
      data.fromId.toLowerCase() === selfThreadsUsername
    ) {
      logger.info(
        { commentId, integrationIdentifier },
        "Threads comment automation skipped self-authored reply",
      )
      return
    }

    const automations = await fbCommentAutomationService.findActiveAutomations({
      workspaceId,
      channelType,
    })

    const workspace = await workspaceService.findById({ id: workspaceId })

    const resolveAttachmentInfo =
      channelType === "threads"
        ? async () => ({ hasImage: false, hasVideo: false })
        : createAttachmentInfoResolver({
            channelType,
            workspaceId,
            commentId,
            integrationRow,
            auth,
          })

    let processingFailed = false

    for (const automation of automations) {
      try {
        if (
          !fbCommentAutomationService.isWithinSchedule(
            automation,
            workspace.timezone,
          )
        ) {
          logAutomationSkipped({
            automationId: automation.id,
            commentId,
            postId,
            workspaceId,
            reason: "outside schedule",
          })
          continue
        }
        if (!matchPost(automation.post, postId)) {
          logAutomationSkipped({
            automationId: automation.id,
            commentId,
            postId,
            workspaceId,
            reason: "post does not match",
          })
          continue
        }
        if (
          automation.options.ignoreCommentReplies &&
          isCommentReply(parentId, postId)
        ) {
          logAutomationSkipped({
            automationId: automation.id,
            commentId,
            postId,
            workspaceId,
            reason: "comment is a reply",
          })
          continue
        }
        if (
          !matchKeywords(
            automation.includeKeywords,
            automation.excludeKeywords,
            message,
          )
        ) {
          logAutomationSkipped({
            automationId: automation.id,
            commentId,
            postId,
            workspaceId,
            reason: "keywords do not match",
          })
          continue
        }

        if (automation.options.replyToNewContactsOnly) {
          const priorCount =
            await fbCommentAutomationService.getPriorContactInboxCount({
              contactId: contactInbox.contactId,
            })
          if (priorCount > 1) {
            logAutomationSkipped({
              automationId: automation.id,
              commentId,
              postId,
              workspaceId,
              reason: "contact is not new",
            })
            continue
          }
        }

        if (automation.options.replyOncePerUserPerPost) {
          const claim = await fbCommentAutomationService.claimDedup({
            automationId: automation.id,
            commentId,
            contactId: contactInbox.contactId,
            postId,
            workspaceId,
          })
          if (claim === "conflict") {
            logAutomationSkipped({
              automationId: automation.id,
              commentId,
              postId,
              workspaceId,
              reason: "already replied to this user on this post",
            })
            continue
          }
        }

        if (!automation.options.replyToUsersWhoCommentedOnOtherPosts) {
          const repliedElsewhere =
            await fbCommentAutomationService.hasRepliedOnOtherPost({
              automationId: automation.id,
              contactId: contactInbox.contactId,
              postId,
            })
          if (repliedElsewhere) {
            logAutomationSkipped({
              automationId: automation.id,
              commentId,
              postId,
              workspaceId,
              reason: "user already engaged on another post",
            })
            continue
          }
        }

        const dispatch = await fbCommentAutomationService.getOrCreateDispatch({
          automationId: automation.id,
          commentId,
          workspaceId,
        })
        if (dispatch.scheduledAt) {
          logAutomationSkipped({
            automationId: automation.id,
            commentId,
            postId,
            workspaceId,
            reason: "comment dispatch already scheduled",
          })
          continue
        }

        const delay = computeDelayMs(automation.replyAfter)

        const messageRepo = await createMessageRepository()
        const dbMessage = await messageRepo.findBySourceId(
          commentId,
          conversationId,
          workspaceId,
          new Date(createdTime * 1000),
        )

        let parentMessageId: string | null = null
        let parentMessageCreatedAt: Date | null = null

        if (dbMessage) {
          parentMessageId = dbMessage.id
          parentMessageCreatedAt = dbMessage.createdAt
          const conversationRef = {
            id: conversationId,
            workspaceId,
          } as ConversationModel
          const messageRef = {
            id: dbMessage.id,
            createdAt: dbMessage.createdAt,
          }

          if (automation.options.likeUserComment && channelType !== "threads") {
            chatQueue
              .add(ChatJobAction.changeChannelMessageState, {
                type: ChatJobAction.changeChannelMessageState,
                data: {
                  conversation: conversationRef,
                  contactInbox,
                  message: messageRef,
                  liked: true,
                },
              })
              .catch((err: unknown) =>
                logger.error(
                  { err, automationId: automation.id, commentId },
                  "Failed to like comment",
                ),
              )
          }

          if (channelType !== "threads") {
            const { hasImage, hasVideo } = needsAttachmentInfo(
              automation.hideComments,
            )
              ? await resolveAttachmentInfo()
              : { hasImage: false, hasVideo: false }

            applyHideComments(automation.hideComments, commentId, message, {
              conversation: conversationRef,
              contactInbox,
              messageId: dbMessage.id,
              messageCreatedAt: dbMessage.createdAt,
              hasImage,
              hasVideo,
            }).catch((err: unknown) =>
              logger.error(
                { err, automationId: automation.id, commentId },
                "Failed to apply hide comments",
              ),
            )
          } else if (hasHideCommentRule(automation.hideComments)) {
            logger.info(
              { automationId: automation.id, commentId },
              "Threads comment automation skipped unsupported hide comment rule",
            )
          }
        }

        let dispatchFailed = false
        let didSchedulePublicReply = false
        let didSchedulePrivateReply = false

        try {
          await executePublicReply(automation.publicReply, {
            automationId: automation.id,
            integrationType,
            integrationIdentifier,
            commentId,
            channelType,
            conversationId,
            contactInboxId,
            delay,
            workspaceId,
            contactInbox,
            message,
            parentMessageId,
            parentMessageCreatedAt,
          })
          didSchedulePublicReply = didAutomationActuallySendPublicReply(
            automation.publicReply,
            channelType,
          )
        } catch (err) {
          logger.error(
            { err, automationId: automation.id, commentId },
            "Failed to send public reply",
          )
          if (willSendPublicReply(automation.publicReply)) {
            dispatchFailed = true
          }
        }

        try {
          await executePrivateReply(automation.privateReply, {
            automationId: automation.id,
            integrationType,
            integrationIdentifier,
            commentId,
            channelType,
            conversationId,
            contactInboxId,
            contactInbox,
            workspaceId,
            delay,
            message,
          })
          didSchedulePrivateReply = didAutomationActuallySendPrivateReply(
            automation.privateReply,
            channelType,
          )
        } catch (err) {
          logger.error(
            { err, automationId: automation.id, commentId },
            "Failed to send private reply",
          )
          if (willSendReply(automation.privateReply)) {
            dispatchFailed = true
          }
        }

        if (dispatchFailed) {
          throw new Error("One or more comment automation replies failed")
        }

        await fbCommentAutomationService.markDispatchScheduled({
          automationId: automation.id,
          commentId,
          workspaceId,
          hasReply: didSchedulePublicReply || didSchedulePrivateReply,
        })
      } catch (err) {
        processingFailed = true
        logger.error(
          { err, automationId: automation.id, commentId, workspaceId },
          "Failed to process comment automation",
        )
      }
    }

    if (processingFailed) {
      throw new Error("One or more comment automations failed")
    }
  })
}

const logAutomationSkipped = ({
  automationId,
  commentId,
  postId,
  workspaceId,
  reason,
}: {
  automationId: string
  commentId: string
  postId: string
  workspaceId: string
  reason: string
}) => {
  logger.info(
    { automationId, commentId, postId, workspaceId, reason },
    "Comment automation skipped",
  )
}

function hasHideCommentRule(hideComments: FBCommentHideComments): boolean {
  return (
    hideComments.all ||
    hideComments.hasPhoneNumber ||
    hideComments.hasImage ||
    hideComments.hasVideo ||
    hideComments.hasLink ||
    hideComments.hasKeywords ||
    hideComments.keywords.length > 0 ||
    hideComments.showCommentsAfter !== "none"
  )
}

function didAutomationActuallySendPublicReply(
  reply: FBCommentPublicReply,
  channelType: "messenger" | "instagram" | "instagramFacebook" | "threads",
): boolean {
  if (channelType === "threads") {
    return reply.type === "text" && willSendPublicReply(reply)
  }

  return willSendPublicReply(reply)
}

function didAutomationActuallySendPrivateReply(
  reply: FBCommentReply,
  channelType: "messenger" | "instagram" | "instagramFacebook" | "threads",
): boolean {
  if (channelType === "threads") {
    return false
  }

  return willSendReply(reply)
}
