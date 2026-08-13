import { beforeEach, describe, expect, test, vi } from "vitest"

const txExecute = vi.fn()
const txFindFirst = vi.fn()
const connectChannelIntegration = vi.fn()
const dbTransaction = vi.fn(
  async (callback: (tx: unknown) => unknown) => await callback(mockTx),
)

const mockTx = {
  execute: txExecute,
  query: {
    integrationThreadsModel: {
      findFirst: txFindFirst,
    },
  },
}

vi.mock("@chatbotx.io/database/client", () => ({
  and: vi.fn(),
  db: {
    transaction: dbTransaction,
  },
  eq: vi.fn(),
  sql: vi.fn(),
}))

vi.mock("@chatbotx.io/database/partials", () => ({
  inboxStatuses: { enum: { disconnected: "disconnected" } },
}))

vi.mock("@chatbotx.io/database/schema", () => ({
  inboxModel: {},
  integrationThreadsModel: {},
}))

vi.mock("@chatbotx.io/utils", () => ({
  createId: vi.fn(() => "generated-id"),
}))

vi.mock("../src/inbox/connect-channel", () => ({
  connectChannelIntegration,
}))

vi.mock("../src/inbox/service", () => ({
  inboxService: { disconnect: vi.fn() },
}))

vi.mock("../src/workspace/service", () => ({
  workspaceService: { findById: vi.fn() },
}))

const { integrationThreadsService } = await import(
  "../src/integration-threads/service"
)

beforeEach(() => {
  txExecute.mockReset()
  txFindFirst.mockReset().mockResolvedValue(undefined)
  connectChannelIntegration.mockReset().mockResolvedValue({
    integration: { id: "integration-1" },
  })
  dbTransaction.mockClear()
})

describe("integrationThreadsService.connect", () => {
  test("takes a transaction-scoped advisory lock before connecting", async () => {
    await integrationThreadsService.connect({
      workspaceId: "workspace-1",
      ownerId: "owner-1",
      auth: { tokens: { accessToken: "token" } },
      threadsUserId: "threads-user-1",
      username: "threads-user",
      name: "Threads User",
      tx: mockTx as never,
    })

    expect(txExecute).toHaveBeenCalledOnce()
    expect(txFindFirst).toHaveBeenCalledWith({
      columns: { id: true },
      where: { threadsUserId: "threads-user-1" },
    })
    expect(connectChannelIntegration).toHaveBeenCalledOnce()
    expect(txExecute.mock.invocationCallOrder[0]).toBeLessThan(
      txFindFirst.mock.invocationCallOrder[0],
    )
    expect(txFindFirst.mock.invocationCallOrder[0]).toBeLessThan(
      connectChannelIntegration.mock.invocationCallOrder[0],
    )
  })

  test("rejects duplicates before creating the inbox", async () => {
    txFindFirst.mockResolvedValueOnce({ id: "existing-1" })

    await expect(
      integrationThreadsService.connect({
        workspaceId: "workspace-1",
        ownerId: "owner-1",
        auth: { tokens: { accessToken: "token" } },
        threadsUserId: "threads-user-1",
        username: "threads-user",
        name: "Threads User",
        tx: mockTx as never,
      }),
    ).rejects.toMatchObject({ code: "channelDuplicated" })

    expect(txExecute).toHaveBeenCalledOnce()
    expect(connectChannelIntegration).not.toHaveBeenCalled()
  })

  test("opens a transaction automatically when no tx is provided", async () => {
    await integrationThreadsService.connect({
      workspaceId: "workspace-1",
      ownerId: "owner-1",
      auth: { tokens: { accessToken: "token" } },
      threadsUserId: "threads-user-1",
      username: "threads-user",
      name: "Threads User",
    })

    expect(dbTransaction).toHaveBeenCalledOnce()
    expect(connectChannelIntegration).toHaveBeenCalledOnce()
  })
})
