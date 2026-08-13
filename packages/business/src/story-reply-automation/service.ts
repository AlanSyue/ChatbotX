import {
  and,
  type DatabaseClient,
  db,
  eq,
  inArray,
  isNull,
  relationsFilterToSQL,
  sql,
} from "@chatbotx.io/database/client"
import type {
  StoryReplyAutomationIncludeKeywords,
  StoryReplyAutomationReply,
  StoryReplyAutomationReplyAfter,
  StoryReplyAutomationStoryTarget,
  StoryReplyAutomationType,
} from "@chatbotx.io/database/partials"
import { rootFolderId } from "@chatbotx.io/database/partials"
import {
  storyReplyAutomationDispatchModel,
  storyReplyAutomationModel,
} from "@chatbotx.io/database/schema"
import type {
  StoryReplyAutomationDispatchModel,
  StoryReplyAutomationModel,
} from "@chatbotx.io/database/types"
import {
  getPaginationWithDefaults,
  parseOrderByAsObject,
} from "@chatbotx.io/database/utils"
import { createId } from "@chatbotx.io/utils"
import { formatInTimeZone } from "date-fns-tz"
import { BaseService } from "../base.service"
import { notFoundException } from "../errors"
import type { PaginatedResult } from "../types"

export type CreateStoryReplyAutomationRequest = {
  name: string
  folderId?: string | null
  type: StoryReplyAutomationType
  isActive?: boolean
  startTime?: string | null
  endTime?: string | null
  storyTarget: StoryReplyAutomationStoryTarget
  includeKeywords: StoryReplyAutomationIncludeKeywords
  excludeKeywords?: string[]
  reply: StoryReplyAutomationReply
  replyAfter: StoryReplyAutomationReplyAfter
}

export type UpdateStoryReplyAutomationRequest =
  Partial<CreateStoryReplyAutomationRequest>

export type FindStoryReplyAutomationRequest = {
  workspaceId: string
  id: string
}

export type ListStoryReplyAutomationsRequest = {
  workspaceId: string
  folderId?: string | null
  page: number
  perPage: number
  keyword?: string | null
  sort: Array<{ id: string; desc: boolean }>
}

class StoryReplyAutomationService extends BaseService {
  async find(
    input: FindStoryReplyAutomationRequest,
    tx?: DatabaseClient,
  ): Promise<StoryReplyAutomationModel | undefined> {
    const client = tx ?? db
    return await client.query.storyReplyAutomationModel.findFirst({
      where: { id: input.id, workspaceId: input.workspaceId },
    })
  }

  async findOrFail(
    input: FindStoryReplyAutomationRequest,
    tx?: DatabaseClient,
  ): Promise<StoryReplyAutomationModel> {
    const result = await this.find(input, tx)
    if (!result) {
      throw notFoundException("Story reply automation not found")
    }
    return result
  }

  async list(
    input: ListStoryReplyAutomationsRequest,
  ): Promise<PaginatedResult<StoryReplyAutomationModel>> {
    let folderFilter: string | { isNull: true } | undefined
    if (input.folderId === rootFolderId) {
      folderFilter = { isNull: true }
    } else if (typeof input.folderId === "string") {
      folderFilter = input.folderId
    }

    const where = {
      workspaceId: input.workspaceId,
      name: input.keyword
        ? { ilike: `%${input.keyword.toLowerCase()}%` }
        : undefined,
      folderId: folderFilter,
    }

    const pagination = getPaginationWithDefaults(input)
    const orderBy = parseOrderByAsObject(storyReplyAutomationModel, input)

    const [data, total] = await Promise.all([
      db.query.storyReplyAutomationModel.findMany({
        where,
        orderBy,
        ...pagination,
      }),
      db.$count(
        storyReplyAutomationModel,
        relationsFilterToSQL(storyReplyAutomationModel, where),
      ),
    ])

    const pageCount = Math.ceil(total / input.perPage)
    return { data, pageCount }
  }

  async create(
    workspaceId: string,
    values: CreateStoryReplyAutomationRequest,
    tx?: DatabaseClient,
  ): Promise<StoryReplyAutomationModel> {
    const client = tx ?? db
    const [created] = await client
      .insert(storyReplyAutomationModel)
      .values({
        id: createId(),
        workspaceId,
        ...values,
      })
      .returning()
    return created
  }

  async update(
    ctx: { id: string; workspaceId: string },
    data: UpdateStoryReplyAutomationRequest,
    tx?: DatabaseClient,
  ): Promise<StoryReplyAutomationModel> {
    const client = tx ?? db
    const [updated] = await client
      .update(storyReplyAutomationModel)
      .set(data)
      .where(
        and(
          eq(storyReplyAutomationModel.id, ctx.id),
          eq(storyReplyAutomationModel.workspaceId, ctx.workspaceId),
        ),
      )
      .returning()
    if (!updated) {
      throw notFoundException("Story reply automation not found")
    }
    return updated
  }

  async delete(
    ctx: { id: string; workspaceId: string },
    tx?: DatabaseClient,
  ): Promise<void> {
    await this.findOrFail(ctx, tx)
    const client = tx ?? db
    await client
      .delete(storyReplyAutomationModel)
      .where(
        and(
          eq(storyReplyAutomationModel.id, ctx.id),
          eq(storyReplyAutomationModel.workspaceId, ctx.workspaceId),
        ),
      )
  }

  async deleteMany(
    workspaceId: string,
    ids: string[],
    tx?: DatabaseClient,
  ): Promise<void> {
    const client = tx ?? db
    await client
      .delete(storyReplyAutomationModel)
      .where(
        and(
          eq(storyReplyAutomationModel.workspaceId, workspaceId),
          inArray(storyReplyAutomationModel.id, ids),
        ),
      )
  }

  findActiveAutomations(props: {
    workspaceId: string
    channelType: "messenger" | "instagram"
  }): Promise<StoryReplyAutomationModel[]> {
    return db.query.storyReplyAutomationModel.findMany({
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
    return currentTime >= startTime || currentTime <= endTime
  }

  async claimDedup(props: {
    automationId: string
    storyReplyMessageId: string
    workspaceId: string
  }): Promise<"claimed" | "owned"> {
    const [inserted] = await db
      .insert(storyReplyAutomationDispatchModel)
      .values({ id: createId(), ...props })
      .onConflictDoNothing()
      .returning({
        storyReplyMessageId:
          storyReplyAutomationDispatchModel.storyReplyMessageId,
      })

    return inserted ? "claimed" : "owned"
  }

  async getOrCreateDispatch(props: {
    automationId: string
    storyReplyMessageId: string
    workspaceId: string
  }): Promise<StoryReplyAutomationDispatchModel> {
    const [inserted] = await db
      .insert(storyReplyAutomationDispatchModel)
      .values({ id: createId(), ...props })
      .onConflictDoNothing()
      .returning()

    if (inserted) {
      return inserted
    }

    const existing = await db.query.storyReplyAutomationDispatchModel.findFirst(
      {
        where: props,
      },
    )

    if (!existing) {
      throw new Error("Story reply automation dispatch claim was not found")
    }
    return existing
  }

  async claimReplySend(props: {
    automationId: string
    storyReplyMessageId: string
    workspaceId: string
  }): Promise<"claimed" | "already-sent"> {
    const [claimed] = await db
      .update(storyReplyAutomationDispatchModel)
      .set({ privateReplySentAt: new Date() })
      .where(
        and(
          eq(
            storyReplyAutomationDispatchModel.automationId,
            props.automationId,
          ),
          eq(
            storyReplyAutomationDispatchModel.storyReplyMessageId,
            props.storyReplyMessageId,
          ),
          eq(storyReplyAutomationDispatchModel.workspaceId, props.workspaceId),
          isNull(storyReplyAutomationDispatchModel.privateReplySentAt),
        ),
      )
      .returning({ id: storyReplyAutomationDispatchModel.id })

    return claimed ? "claimed" : "already-sent"
  }

  markDispatchScheduled(props: {
    automationId: string
    storyReplyMessageId: string
    workspaceId: string
    hasReply: boolean
  }): Promise<boolean> {
    return db.transaction(async (tx) => {
      const [completed] = await tx
        .update(storyReplyAutomationDispatchModel)
        .set({ scheduledAt: new Date() })
        .where(
          and(
            eq(
              storyReplyAutomationDispatchModel.automationId,
              props.automationId,
            ),
            eq(
              storyReplyAutomationDispatchModel.storyReplyMessageId,
              props.storyReplyMessageId,
            ),
            eq(
              storyReplyAutomationDispatchModel.workspaceId,
              props.workspaceId,
            ),
            isNull(storyReplyAutomationDispatchModel.scheduledAt),
          ),
        )
        .returning({ id: storyReplyAutomationDispatchModel.id })

      if (!completed) {
        return false
      }

      if (props.hasReply) {
        await tx
          .update(storyReplyAutomationModel)
          .set({
            repliesCount: sql`${storyReplyAutomationModel.repliesCount} + 1`,
          })
          .where(
            and(
              eq(storyReplyAutomationModel.id, props.automationId),
              eq(storyReplyAutomationModel.workspaceId, props.workspaceId),
            ),
          )
      }
      return true
    })
  }
}

export const storyReplyAutomationService = new StoryReplyAutomationService()
