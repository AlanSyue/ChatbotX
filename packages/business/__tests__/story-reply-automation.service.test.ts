import { beforeEach, describe, expect, test, vi } from "vitest"

const {
  and,
  dbInsert,
  dbTransaction,
  dbUpdate,
  dispatchUpdateBuilder,
  eq,
  findFirst,
  insertBuilder,
  isNull,
  repliesUpdateBuilder,
  sql,
  storyReplyAutomationDispatchModel,
  storyReplyAutomationModel,
} = vi.hoisted(() => {
  const storyReplyAutomationDispatchModel = {
    id: "dispatch.id",
    automationId: "dispatch.automationId",
    storyReplyMessageId: "dispatch.storyReplyMessageId",
    workspaceId: "dispatch.workspaceId",
    scheduledAt: "dispatch.scheduledAt",
    privateReplySentAt: "dispatch.privateReplySentAt",
  }
  const storyReplyAutomationModel = {
    id: "story.id",
    workspaceId: "story.workspaceId",
    repliesCount: "story.repliesCount",
  }

  const eq = vi.fn((column: string, value: unknown) => ({
    op: "eq",
    column,
    value,
  }))
  const isNull = vi.fn((column: string) => ({ op: "isNull", column }))
  const and = vi.fn((...args: unknown[]) => ({ op: "and", args }))
  const sql = vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
    op: "sql",
    text: strings.join("?"),
    values,
  }))

  const insertBuilder = {
    values: vi.fn(),
    onConflictDoNothing: vi.fn(),
    returning: vi.fn(),
  }
  insertBuilder.values.mockReturnValue(insertBuilder)
  insertBuilder.onConflictDoNothing.mockReturnValue(insertBuilder)

  const dispatchUpdateBuilder = {
    set: vi.fn(),
    where: vi.fn(),
    returning: vi.fn(),
  }
  dispatchUpdateBuilder.set.mockReturnValue(dispatchUpdateBuilder)
  dispatchUpdateBuilder.where.mockReturnValue(dispatchUpdateBuilder)

  const repliesUpdateBuilder = {
    set: vi.fn(),
    where: vi.fn(),
  }
  repliesUpdateBuilder.set.mockReturnValue(repliesUpdateBuilder)
  repliesUpdateBuilder.where.mockResolvedValue(undefined)

  const findFirst = vi.fn()
  const dbInsert = vi.fn(() => insertBuilder)
  const dbUpdate = vi.fn(() => dispatchUpdateBuilder)
  const dbTransaction = vi.fn(
    async (callback: (tx: any) => Promise<unknown>) =>
      await callback({
        update: vi
          .fn()
          .mockImplementationOnce(() => dispatchUpdateBuilder)
          .mockImplementationOnce(() => repliesUpdateBuilder),
      }),
  )

  return {
    and,
    dbInsert,
    dbTransaction,
    dbUpdate,
    dispatchUpdateBuilder,
    eq,
    findFirst,
    insertBuilder,
    isNull,
    repliesUpdateBuilder,
    sql,
    storyReplyAutomationDispatchModel,
    storyReplyAutomationModel,
  }
})

vi.mock("@chatbotx.io/database/client", () => ({
  and,
  db: {
    insert: dbInsert,
    update: dbUpdate,
    transaction: dbTransaction,
    query: {
      storyReplyAutomationDispatchModel: {
        findFirst,
      },
      storyReplyAutomationModel: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
    },
  },
  eq,
  inArray: vi.fn(),
  isNull,
  relationsFilterToSQL: vi.fn(),
  sql,
}))

vi.mock("@chatbotx.io/database/schema", () => ({
  storyReplyAutomationDispatchModel,
  storyReplyAutomationModel,
}))

vi.mock("@chatbotx.io/database/partials", () => ({
  rootFolderId: "0",
}))

vi.mock("@chatbotx.io/database/utils", () => ({
  getPaginationWithDefaults: vi.fn(),
  parseOrderByAsObject: vi.fn(),
}))

vi.mock("@chatbotx.io/utils", () => ({
  createId: vi.fn(() => "dispatch-id"),
}))

const { storyReplyAutomationService } = await import(
  "../src/story-reply-automation/service"
)

beforeEach(() => {
  vi.clearAllMocks()
  insertBuilder.values.mockReturnValue(insertBuilder)
  insertBuilder.onConflictDoNothing.mockReturnValue(insertBuilder)
  dispatchUpdateBuilder.set.mockReturnValue(dispatchUpdateBuilder)
  dispatchUpdateBuilder.where.mockReturnValue(dispatchUpdateBuilder)
  repliesUpdateBuilder.set.mockReturnValue(repliesUpdateBuilder)
  repliesUpdateBuilder.where.mockResolvedValue(undefined)
  dbInsert.mockReturnValue(insertBuilder)
  dbUpdate.mockReturnValue(dispatchUpdateBuilder)
  dbTransaction.mockImplementation(
    async (callback: (tx: any) => Promise<unknown>) =>
      await callback({
        update: vi
          .fn()
          .mockImplementationOnce(() => dispatchUpdateBuilder)
          .mockImplementationOnce(() => repliesUpdateBuilder),
      }),
  )
})

describe("storyReplyAutomationService claim and dispatch ledger", () => {
  test("claimDedup returns claimed on first insert and owned on the same message conflict", async () => {
    insertBuilder.returning
      .mockResolvedValueOnce([{ storyReplyMessageId: "mid-1" }])
      .mockResolvedValueOnce([])

    await expect(
      storyReplyAutomationService.claimDedup({
        automationId: "automation-1",
        storyReplyMessageId: "mid-1",
        workspaceId: "workspace-1",
      }),
    ).resolves.toBe("claimed")

    await expect(
      storyReplyAutomationService.claimDedup({
        automationId: "automation-1",
        storyReplyMessageId: "mid-1",
        workspaceId: "workspace-1",
      }),
    ).resolves.toBe("owned")

    expect(insertBuilder.onConflictDoNothing).toHaveBeenCalledTimes(2)
  })

  test("getOrCreateDispatch returns the inserted row, then re-selects the same workspace-scoped row on conflict", async () => {
    insertBuilder.returning
      .mockResolvedValueOnce([
        {
          id: "dispatch-1",
          automationId: "automation-1",
          storyReplyMessageId: "mid-1",
          workspaceId: "workspace-1",
        },
      ])
      .mockResolvedValueOnce([])

    const inserted = await storyReplyAutomationService.getOrCreateDispatch({
      automationId: "automation-1",
      storyReplyMessageId: "mid-1",
      workspaceId: "workspace-1",
    })

    findFirst.mockResolvedValueOnce({
      id: "dispatch-existing",
      automationId: "automation-1",
      storyReplyMessageId: "mid-1",
      workspaceId: "workspace-1",
    })

    const existing = await storyReplyAutomationService.getOrCreateDispatch({
      automationId: "automation-1",
      storyReplyMessageId: "mid-1",
      workspaceId: "workspace-1",
    })

    expect(inserted).toMatchObject({ id: "dispatch-1" })
    expect(findFirst).toHaveBeenCalledWith({
      where: {
        automationId: "automation-1",
        storyReplyMessageId: "mid-1",
        workspaceId: "workspace-1",
      },
    })
    expect(existing).toMatchObject({ id: "dispatch-existing" })
  })

  test("getOrCreateDispatch throws when a conflicting row cannot be re-selected", async () => {
    insertBuilder.returning.mockResolvedValueOnce([])
    findFirst.mockResolvedValueOnce(undefined)

    await expect(
      storyReplyAutomationService.getOrCreateDispatch({
        automationId: "automation-1",
        storyReplyMessageId: "mid-2",
        workspaceId: "workspace-1",
      }),
    ).rejects.toThrow("Story reply automation dispatch claim was not found")
  })

  test("claimReplySend is idempotent and remains workspace scoped", async () => {
    dispatchUpdateBuilder.returning
      .mockResolvedValueOnce([{ id: "dispatch-1" }])
      .mockResolvedValueOnce([])

    await expect(
      storyReplyAutomationService.claimReplySend({
        automationId: "automation-1",
        storyReplyMessageId: "mid-1",
        workspaceId: "workspace-1",
      }),
    ).resolves.toBe("claimed")

    await expect(
      storyReplyAutomationService.claimReplySend({
        automationId: "automation-1",
        storyReplyMessageId: "mid-1",
        workspaceId: "workspace-1",
      }),
    ).resolves.toBe("already-sent")

    expect(dispatchUpdateBuilder.where).toHaveBeenCalled()
    expect(dispatchUpdateBuilder.where.mock.calls[0][0]).toEqual({
      op: "and",
      args: expect.arrayContaining([
        {
          op: "eq",
          column: "dispatch.automationId",
          value: "automation-1",
        },
        {
          op: "eq",
          column: "dispatch.storyReplyMessageId",
          value: "mid-1",
        },
        {
          op: "eq",
          column: "dispatch.workspaceId",
          value: "workspace-1",
        },
        {
          op: "isNull",
          column: "dispatch.privateReplySentAt",
        },
      ]),
    })
  })

  test("markDispatchScheduled flips the ledger row once and increments repliesCount once with workspace scoping", async () => {
    dispatchUpdateBuilder.returning.mockResolvedValueOnce([
      { id: "dispatch-1" },
    ])

    await expect(
      storyReplyAutomationService.markDispatchScheduled({
        automationId: "automation-1",
        storyReplyMessageId: "mid-1",
        workspaceId: "workspace-1",
        hasReply: true,
      }),
    ).resolves.toBe(true)

    expect(dispatchUpdateBuilder.where.mock.calls[0][0]).toEqual({
      op: "and",
      args: expect.arrayContaining([
        {
          op: "eq",
          column: "dispatch.workspaceId",
          value: "workspace-1",
        },
        {
          op: "isNull",
          column: "dispatch.scheduledAt",
        },
      ]),
    })
    expect(repliesUpdateBuilder.set).toHaveBeenCalledWith({
      repliesCount: {
        op: "sql",
        text: "? + 1",
        values: ["story.repliesCount"],
      },
    })
    expect(repliesUpdateBuilder.where).toHaveBeenCalledWith({
      op: "and",
      args: [
        {
          op: "eq",
          column: "story.id",
          value: "automation-1",
        },
        {
          op: "eq",
          column: "story.workspaceId",
          value: "workspace-1",
        },
      ],
    })
  })

  test("markDispatchScheduled returns false and skips the replies counter when another worker already scheduled it", async () => {
    dispatchUpdateBuilder.returning.mockResolvedValueOnce([])

    await expect(
      storyReplyAutomationService.markDispatchScheduled({
        automationId: "automation-1",
        storyReplyMessageId: "mid-1",
        workspaceId: "workspace-1",
        hasReply: true,
      }),
    ).resolves.toBe(false)

    expect(repliesUpdateBuilder.set).not.toHaveBeenCalled()
    expect(repliesUpdateBuilder.where).not.toHaveBeenCalled()
  })
})
