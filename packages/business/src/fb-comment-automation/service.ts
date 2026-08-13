import { and, db, eq, isNull, ne, sql } from "@chatbotx.io/database/client"
import {
  contactInboxModel,
  fbCommentAutomationDispatchModel,
  fbCommentAutomationModel,
  fbCommentAutomationReplyModel,
} from "@chatbotx.io/database/schema"
import { createId } from "@chatbotx.io/utils"
import { formatInTimeZone } from "date-fns-tz"
import { BaseService } from "../base.service"

class FbCommentAutomationService extends BaseService {
  findActiveAutomations(props: {
    workspaceId: string
    channelType: "messenger" | "instagram" | "instagramFacebook"
  }) {
    return db.query.fbCommentAutomationModel.findMany({
      where: {
        workspaceId: props.workspaceId,
        isActive: true,
        type: props.channelType,
      },
    })
  }

  isWithinSchedule(
    automation: { startTime: string | null; endTime: string | null },
    timezone: string,
  ): boolean {
    const { startTime, endTime } = automation
    if (!(startTime && endTime)) {
      return true
    }
    const currentTime = formatInTimeZone(new Date(), timezone, "HH:mm")

    if (startTime <= endTime) {
      return currentTime >= startTime && currentTime <= endTime
    }
    // Overnight window (endTime is earlier than startTime, e.g. 22:00-06:00).
    return currentTime >= startTime || currentTime <= endTime
  }

  getPriorContactInboxCount(props: { contactId: string }) {
    return db.$count(
      contactInboxModel,
      eq(contactInboxModel.contactId, props.contactId),
    )
  }

  findDedup(props: {
    automationId: string
    contactId: string
    postId: string
  }) {
    return db.query.fbCommentAutomationReplyModel.findFirst({
      where: {
        automationId: props.automationId,
        contactId: props.contactId,
        postId: props.postId,
      },
    })
  }

  async claimDedup(props: {
    automationId: string
    commentId: string
    contactId: string
    postId: string
    workspaceId: string
  }): Promise<"claimed" | "owned" | "conflict"> {
    const [inserted] = await db
      .insert(fbCommentAutomationReplyModel)
      .values({ id: createId(), ...props })
      .onConflictDoNothing()
      .returning({ commentId: fbCommentAutomationReplyModel.commentId })

    if (inserted) {
      return "claimed"
    }

    const existing = await db.query.fbCommentAutomationReplyModel.findFirst({
      where: {
        automationId: props.automationId,
        contactId: props.contactId,
        postId: props.postId,
        workspaceId: props.workspaceId,
      },
      columns: { commentId: true },
    })

    return existing?.commentId === props.commentId ? "owned" : "conflict"
  }

  async insertDedup(props: {
    automationId: string
    contactId: string
    postId: string
    workspaceId: string
  }) {
    await db
      .insert(fbCommentAutomationReplyModel)
      .values({ id: createId(), ...props })
      .onConflictDoNothing()
  }

  async hasRepliedOnOtherPost(props: {
    automationId: string
    contactId: string
    postId: string
  }): Promise<boolean> {
    const rows = await db
      .select({ one: sql`1` })
      .from(fbCommentAutomationReplyModel)
      .where(
        and(
          eq(fbCommentAutomationReplyModel.automationId, props.automationId),
          eq(fbCommentAutomationReplyModel.contactId, props.contactId),
          ne(fbCommentAutomationReplyModel.postId, props.postId),
        ),
      )
      .limit(1)
    return rows.length > 0
  }

  async getOrCreateDispatch(props: {
    automationId: string
    commentId: string
    workspaceId: string
  }) {
    const [inserted] = await db
      .insert(fbCommentAutomationDispatchModel)
      .values({ id: createId(), ...props })
      .onConflictDoNothing()
      .returning()

    if (inserted) {
      return inserted
    }

    const existing = await db.query.fbCommentAutomationDispatchModel.findFirst({
      where: props,
    })

    if (!existing) {
      throw new Error("Comment automation dispatch claim was not found")
    }
    return existing
  }

  async reservePublicMessage(props: {
    automationId: string
    commentId: string
    workspaceId: string
    messageId: string
    messageCreatedAt: Date
  }): Promise<{ messageId: string; messageCreatedAt: Date }> {
    const [reserved] = await db
      .update(fbCommentAutomationDispatchModel)
      .set({
        publicMessageId: props.messageId,
        publicMessageCreatedAt: props.messageCreatedAt,
      })
      .where(
        and(
          eq(fbCommentAutomationDispatchModel.automationId, props.automationId),
          eq(fbCommentAutomationDispatchModel.commentId, props.commentId),
          eq(fbCommentAutomationDispatchModel.workspaceId, props.workspaceId),
          isNull(fbCommentAutomationDispatchModel.publicMessageId),
        ),
      )
      .returning({
        messageId: fbCommentAutomationDispatchModel.publicMessageId,
        messageCreatedAt:
          fbCommentAutomationDispatchModel.publicMessageCreatedAt,
      })

    if (reserved?.messageId && reserved.messageCreatedAt) {
      return {
        messageId: reserved.messageId,
        messageCreatedAt: reserved.messageCreatedAt,
      }
    }

    const existing = await db.query.fbCommentAutomationDispatchModel.findFirst({
      where: {
        automationId: props.automationId,
        commentId: props.commentId,
        workspaceId: props.workspaceId,
      },
      columns: { publicMessageId: true, publicMessageCreatedAt: true },
    })

    if (!(existing?.publicMessageId && existing.publicMessageCreatedAt)) {
      throw new Error("Public comment reply message reservation failed")
    }
    return {
      messageId: existing.publicMessageId,
      messageCreatedAt: existing.publicMessageCreatedAt,
    }
  }

  async claimPrivateReplySend(props: {
    automationId: string
    commentId: string
    workspaceId: string
  }): Promise<"claimed" | "already-sent"> {
    const [claimed] = await db
      .update(fbCommentAutomationDispatchModel)
      .set({ privateReplySentAt: new Date() })
      .where(
        and(
          eq(fbCommentAutomationDispatchModel.automationId, props.automationId),
          eq(fbCommentAutomationDispatchModel.commentId, props.commentId),
          eq(fbCommentAutomationDispatchModel.workspaceId, props.workspaceId),
          isNull(fbCommentAutomationDispatchModel.privateReplySentAt),
        ),
      )
      .returning({ id: fbCommentAutomationDispatchModel.id })

    return claimed ? "claimed" : "already-sent"
  }

  markDispatchScheduled(props: {
    automationId: string
    commentId: string
    workspaceId: string
    hasReply: boolean
  }): Promise<boolean> {
    return db.transaction(async (tx) => {
      const [completed] = await tx
        .update(fbCommentAutomationDispatchModel)
        .set({ scheduledAt: new Date() })
        .where(
          and(
            eq(
              fbCommentAutomationDispatchModel.automationId,
              props.automationId,
            ),
            eq(fbCommentAutomationDispatchModel.commentId, props.commentId),
            eq(fbCommentAutomationDispatchModel.workspaceId, props.workspaceId),
            isNull(fbCommentAutomationDispatchModel.scheduledAt),
          ),
        )
        .returning({ id: fbCommentAutomationDispatchModel.id })

      if (!completed) {
        return false
      }

      if (props.hasReply) {
        await tx
          .update(fbCommentAutomationModel)
          .set({
            repliesCount: sql`${fbCommentAutomationModel.repliesCount} + 1`,
          })
          .where(eq(fbCommentAutomationModel.id, props.automationId))
      }
      return true
    })
  }

  async incrementRepliesCount(automationId: string) {
    await db
      .update(fbCommentAutomationModel)
      .set({
        repliesCount: sql`${fbCommentAutomationModel.repliesCount} + 1`,
      })
      .where(eq(fbCommentAutomationModel.id, automationId))
  }
}

export const fbCommentAutomationService = new FbCommentAutomationService()
