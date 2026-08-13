import {
  and,
  type DatabaseClient,
  db,
  eq,
  sql,
} from "@chatbotx.io/database/client"
import { integrationThreadsModel } from "@chatbotx.io/database/schema"
import type { IntegrationThreadsModel } from "@chatbotx.io/database/types"
import { createId } from "@chatbotx.io/utils"
import { z } from "zod"
import { BaseService } from "../base.service"
import { channelDuplicatedException } from "../errors"
import { connectChannelIntegration } from "../inbox/connect-channel"
import { inboxService } from "../inbox/service"
import { workspaceService } from "../workspace/service"

const threadsRefreshAuthSchema = z
  .object({
    tokens: z
      .object({
        accessToken: z.string().min(1),
        expiresAt: z.string().datetime().optional(),
      })
      .passthrough(),
  })
  .passthrough()

export const THREADS_TOKEN_REFRESH_THRESHOLD_DAYS = 14

export type ThreadsTokenRefreshCandidate = {
  id: string
  workspaceId: string
  auth: Record<string, unknown>
  currentAccessToken: string
}

export type IntegrationThreadsPublicResource = Pick<
  IntegrationThreadsModel,
  | "id"
  | "workspaceId"
  | "inboxId"
  | "threadsUserId"
  | "username"
  | "name"
  | "createdAt"
  | "updatedAt"
>

type ThreadsRefreshRow = {
  id: string
  workspaceId: string
  auth: Record<string, unknown>
}

const lockThreadsAccount = async (
  tx: DatabaseClient,
  threadsUserId: string,
): Promise<void> => {
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${`threads:${threadsUserId}`}, 0))`,
  )
}

class IntegrationThreadsService extends BaseService {
  findByInboxId(inboxId: string) {
    return db.query.integrationThreadsModel.findFirst({
      where: { inboxId },
    })
  }

  findByThreadsUserId(threadsUserId: string) {
    return db.query.integrationThreadsModel.findFirst({
      where: { threadsUserId },
    })
  }

  findByIdForWorkspace(props: { id: string; workspaceId: string }) {
    return db.query.integrationThreadsModel.findFirst({
      where: props,
    })
  }

  async listByWorkspaceId(props: {
    workspaceId: string
    tx?: DatabaseClient
  }): Promise<{ data: IntegrationThreadsModel[] }> {
    const client = props.tx ?? db
    const data = await client.query.integrationThreadsModel.findMany({
      where: { workspaceId: props.workspaceId },
      orderBy: { createdAt: "asc" },
    })

    return { data }
  }

  async listPublicByWorkspaceId(props: {
    workspaceId: string
    tx?: DatabaseClient
  }): Promise<{ data: IntegrationThreadsPublicResource[] }> {
    const client = props.tx ?? db
    const data = await client.query.integrationThreadsModel.findMany({
      columns: {
        id: true,
        workspaceId: true,
        inboxId: true,
        threadsUserId: true,
        username: true,
        name: true,
        createdAt: true,
        updatedAt: true,
      },
      where: { workspaceId: props.workspaceId },
      orderBy: { createdAt: "asc" },
    })

    return { data }
  }

  async connect(props: {
    workspaceId: string
    ownerId: string
    auth: Record<string, unknown>
    threadsUserId: string
    username: string
    name: string
    tx?: DatabaseClient
  }): Promise<IntegrationThreadsModel> {
    if (!props.tx) {
      return db.transaction(async (tx) => await this.connect({ ...props, tx }))
    }

    const tx = props.tx
    await lockThreadsAccount(tx, props.threadsUserId)

    const existing = await tx.query.integrationThreadsModel.findFirst({
      columns: {
        id: true,
      },
      where: {
        threadsUserId: props.threadsUserId,
      },
    })
    if (existing) {
      throw channelDuplicatedException()
    }

    const { integration } = await connectChannelIntegration({
      tx,
      ownerId: props.ownerId,
      inboxData: {
        id: createId(),
        workspaceId: props.workspaceId,
        name: props.name,
        channel: "threads",
        sourceId: props.threadsUserId,
      },
      insertIntegration: async (inboxId) =>
        tx
          .insert(integrationThreadsModel)
          .values({
            id: createId(),
            inboxId,
            workspaceId: props.workspaceId,
            auth: props.auth,
            threadsUserId: props.threadsUserId,
            username: props.username,
            name: props.name,
          })
          .returning()
          .then((rows) => rows[0] as IntegrationThreadsModel),
    })

    return integration as IntegrationThreadsModel
  }

  async reconnect(props: {
    workspaceId: string
    id: string
    auth: Record<string, unknown>
    username: string
    name: string
    tx?: DatabaseClient
  }): Promise<boolean> {
    const client = props.tx ?? db
    const rows = await client
      .update(integrationThreadsModel)
      .set({
        auth: props.auth,
        username: props.username,
        name: props.name,
      })
      .where(
        and(
          eq(integrationThreadsModel.id, props.id),
          eq(integrationThreadsModel.workspaceId, props.workspaceId),
        ),
      )
      .returning({ id: integrationThreadsModel.id })

    return rows.length > 0
  }

  async listDueForTokenRefresh(props?: {
    refreshBefore?: Date
    includeMissingExpiresAt?: boolean
  }): Promise<ThreadsTokenRefreshCandidate[]> {
    const refreshBefore =
      props?.refreshBefore ??
      new Date(
        Date.now() + THREADS_TOKEN_REFRESH_THRESHOLD_DAYS * 24 * 60 * 60 * 1000,
      )
    const includeMissingExpiresAt = props?.includeMissingExpiresAt ?? true

    const rows = (await db
      .select({
        id: integrationThreadsModel.id,
        workspaceId: integrationThreadsModel.workspaceId,
        auth: integrationThreadsModel.auth,
      })
      .from(integrationThreadsModel)
      .where(
        sql`${integrationThreadsModel.auth} -> 'tokens' ->> 'accessToken' IS NOT NULL`,
      )) as ThreadsRefreshRow[]

    return rows.flatMap((row) => {
      const parsedAuth = threadsRefreshAuthSchema.safeParse(row.auth)
      if (!parsedAuth.success) {
        return []
      }

      const { accessToken, expiresAt } = parsedAuth.data.tokens
      if (!expiresAt) {
        return includeMissingExpiresAt
          ? [
              {
                id: row.id,
                workspaceId: row.workspaceId,
                auth: row.auth,
                currentAccessToken: accessToken,
              },
            ]
          : []
      }

      const expiresAtDate = new Date(expiresAt)
      if (
        Number.isNaN(expiresAtDate.getTime()) ||
        expiresAtDate > refreshBefore
      ) {
        return []
      }

      return [
        {
          id: row.id,
          workspaceId: row.workspaceId,
          auth: row.auth,
          currentAccessToken: accessToken,
        },
      ]
    })
  }

  async updateAuthIfAccessTokenMatches(props: {
    id: string
    workspaceId: string
    expectedCurrentAccessToken: string
    auth: Record<string, unknown>
    tx?: DatabaseClient
  }): Promise<boolean> {
    const client = props.tx ?? db
    const rows = await client
      .update(integrationThreadsModel)
      .set({ auth: props.auth })
      .where(
        and(
          eq(integrationThreadsModel.id, props.id),
          eq(integrationThreadsModel.workspaceId, props.workspaceId),
          sql`${integrationThreadsModel.auth} -> 'tokens' ->> 'accessToken' = ${props.expectedCurrentAccessToken}`,
        ),
      )
      .returning({ id: integrationThreadsModel.id })

    return rows.length > 0
  }

  async disconnect(props: {
    workspaceId: string
    id: string
    tx?: DatabaseClient
  }): Promise<boolean> {
    if (!props.tx) {
      return db.transaction(
        async (tx) => await this.disconnect({ ...props, tx }),
      )
    }

    const client = props.tx
    const integration = await client.query.integrationThreadsModel.findFirst({
      where: {
        id: props.id,
        workspaceId: props.workspaceId,
      },
    })

    if (!integration) {
      return false
    }

    const workspace = await workspaceService.findById({ id: props.workspaceId })
    if (!workspace) {
      return false
    }

    await client
      .delete(integrationThreadsModel)
      .where(eq(integrationThreadsModel.id, integration.id))

    await inboxService.disconnect({
      inboxId: integration.inboxId,
      ownerId: workspace.ownerId,
      workspaceId: props.workspaceId,
      tx: client,
    })

    return true
  }
}

export const integrationThreadsService = new IntegrationThreadsService()
