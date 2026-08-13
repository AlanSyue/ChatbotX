import { beforeEach, describe, expect, test, vi } from "vitest"

const {
  mockListDueForTokenRefresh,
  mockFindByIdForWorkspace,
  mockUpdateAuthIfAccessTokenMatches,
  mockWithBlockedOwnerGuard,
  mockRefreshAuth,
  mockRunExclusive,
  mockWarn,
} = vi.hoisted(() => ({
  mockListDueForTokenRefresh: vi.fn(),
  mockFindByIdForWorkspace: vi.fn(),
  mockUpdateAuthIfAccessTokenMatches: vi.fn(),
  mockWithBlockedOwnerGuard: vi.fn(),
  mockRefreshAuth: vi.fn(),
  mockRunExclusive: vi.fn(),
  mockWarn: vi.fn(),
}))

vi.mock("@chatbotx.io/business", () => ({
  integrationThreadsService: {
    listDueForTokenRefresh: mockListDueForTokenRefresh,
    findByIdForWorkspace: mockFindByIdForWorkspace,
    updateAuthIfAccessTokenMatches: mockUpdateAuthIfAccessTokenMatches,
  },
  withBlockedOwnerGuard: mockWithBlockedOwnerGuard,
}))

vi.mock("@chatbotx.io/integration-threads", () => ({
  getSafeErrorDetails: vi.fn((error: unknown) => ({
    code: "error",
    httpStatusCode: 500,
    subCode: null,
    type: "error",
    message: error instanceof Error ? error.message : String(error),
  })),
  integration: {
    refreshAuth: mockRefreshAuth,
  },
}))

vi.mock("@chatbotx.io/redis", () => ({
  distributedLock: {
    runExclusive: mockRunExclusive,
  },
}))

vi.mock("../src/lib/logger", () => ({
  logger: {
    warn: mockWarn,
  },
}))

mockRunExclusive.mockImplementation(async ({ fn }) => await fn())
mockWithBlockedOwnerGuard.mockImplementation(
  async (_workspaceId: string, fn: () => Promise<unknown>) => await fn(),
)

const { refreshThreadsTokens } = await import(
  "../src/schedule/handlers/refresh-threads-tokens"
)

describe("refreshThreadsTokens", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRunExclusive.mockImplementation(async ({ fn }) => await fn())
    mockWithBlockedOwnerGuard.mockImplementation(
      async (_workspaceId: string, fn: () => Promise<unknown>) => await fn(),
    )
  })

  test("refreshes due tokens with compare-and-update CAS", async () => {
    mockListDueForTokenRefresh.mockResolvedValue([
      {
        id: "integration-1",
        workspaceId: "workspace-1",
        currentAccessToken: "ignored-by-runtime",
      },
    ])
    mockFindByIdForWorkspace.mockResolvedValue({
      auth: {
        tokens: {
          accessToken: "old-token",
          expiresAt: "2026-08-13T00:00:00.000Z",
        },
        metadata: { threadsUserId: "user-1", version: "v1.0" },
      },
    })
    mockRefreshAuth.mockResolvedValue({
      tokens: {
        accessToken: "new-token",
        expiresAt: "2026-10-01T00:00:00.000Z",
      },
      metadata: { threadsUserId: "user-1", version: "v1.0" },
    })

    await refreshThreadsTokens()

    expect(mockRefreshAuth).toHaveBeenCalledWith({
      auth: {
        tokens: {
          accessToken: "old-token",
          expiresAt: "2026-08-13T00:00:00.000Z",
        },
        metadata: { threadsUserId: "user-1", version: "v1.0" },
      },
    })
    expect(mockUpdateAuthIfAccessTokenMatches).toHaveBeenCalledWith({
      id: "integration-1",
      workspaceId: "workspace-1",
      expectedCurrentAccessToken: "old-token",
      auth: {
        tokens: {
          accessToken: "new-token",
          expiresAt: "2026-10-01T00:00:00.000Z",
        },
        metadata: { threadsUserId: "user-1", version: "v1.0" },
      },
    })
  })

  test("skips records that disappeared or no longer have an access token", async () => {
    mockListDueForTokenRefresh.mockResolvedValue([
      {
        id: "integration-1",
        workspaceId: "workspace-1",
        currentAccessToken: "ignored",
      },
      {
        id: "integration-2",
        workspaceId: "workspace-2",
        currentAccessToken: "ignored",
      },
    ])
    mockFindByIdForWorkspace
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ auth: { tokens: {}, metadata: {} } })

    await refreshThreadsTokens()

    expect(mockRefreshAuth).not.toHaveBeenCalled()
    expect(mockUpdateAuthIfAccessTokenMatches).not.toHaveBeenCalled()
  })

  test("logs sanitized refresh failures", async () => {
    mockListDueForTokenRefresh.mockResolvedValue([
      {
        id: "integration-1",
        workspaceId: "workspace-1",
        currentAccessToken: "ignored",
      },
    ])
    mockFindByIdForWorkspace.mockResolvedValue({
      auth: {
        tokens: { accessToken: "old-token" },
        metadata: { threadsUserId: "user-1", version: "v1.0" },
      },
    })
    mockRefreshAuth.mockRejectedValueOnce(new Error("network"))

    await refreshThreadsTokens()

    expect(mockWarn).toHaveBeenCalledWith(
      expect.objectContaining({
        integrationId: "integration-1",
        workspaceId: "workspace-1",
        errorMessage: "network",
      }),
      "[refreshThreadsTokens] refresh failed",
    )
  })
})
