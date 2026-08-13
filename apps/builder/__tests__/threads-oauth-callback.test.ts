// @vitest-environment node

import type { NextRequest } from "next/server"
import { beforeEach, describe, expect, test, vi } from "vitest"

const {
  mockFindWorkspaceById,
  mockFindWorkspaceMember,
  mockIsMember,
  mockResolveForOwner,
  mockGetAccessState,
  mockGetCurrentUserId,
  mockGetThreadsOAuthStateCookie,
  mockClearThreadsOAuthStateCookie,
  mockExchangeThreadsCode,
  mockGetThreadsProfile,
  mockFindThreadsByIdForWorkspace,
  mockReconnectThreads,
  mockConnectThreads,
  mockFindThreadsByUserId,
  mockRedirect,
  mockNotFound,
} = vi.hoisted(() => ({
  mockFindWorkspaceById: vi.fn(),
  mockFindWorkspaceMember: vi.fn(),
  mockIsMember: vi.fn(),
  mockResolveForOwner: vi.fn(),
  mockGetAccessState: vi.fn(),
  mockGetCurrentUserId: vi.fn(),
  mockGetThreadsOAuthStateCookie: vi.fn(),
  mockClearThreadsOAuthStateCookie: vi.fn(),
  mockExchangeThreadsCode: vi.fn(),
  mockGetThreadsProfile: vi.fn(),
  mockFindThreadsByIdForWorkspace: vi.fn(),
  mockReconnectThreads: vi.fn(),
  mockConnectThreads: vi.fn(),
  mockFindThreadsByUserId: vi.fn(),
  mockRedirect: vi.fn(),
  mockNotFound: vi.fn(() => {
    throw new Error("not found")
  }),
}))

vi.mock("@chatbotx.io/business", () => ({
  integrationFacebookAdsService: { upsert: vi.fn() },
  integrationMetaCatalogService: { upsert: vi.fn() },
  integrationThreadsService: {
    findByIdForWorkspace: mockFindThreadsByIdForWorkspace,
    reconnect: mockReconnectThreads,
    connect: mockConnectThreads,
    findByThreadsUserId: mockFindThreadsByUserId,
  },
  platformCredentialService: { resolveForOwner: mockResolveForOwner },
  resolveWorkspaceFreezeReason: vi.fn(({ workspace }) =>
    workspace.scheduledDeletionAt ? "scheduledDeletion" : null,
  ),
  userQuotaService: { getAccessState: mockGetAccessState },
  workspaceMemberService: {
    isMember: mockIsMember,
    findByWorkspaceIdAndUserId: mockFindWorkspaceMember,
  },
  workspaceService: {
    findById: mockFindWorkspaceById,
    create: vi.fn(),
  },
}))

vi.mock("@chatbotx.io/database/client", () => ({
  db: {},
}))

vi.mock("@chatbotx.io/database/schema", () => ({
  integrationGoogleSheetsModel: {},
  integrationModel: {},
}))

vi.mock("@chatbotx.io/integration-facebook-ads", () => ({
  exchangeCodeForToken: vi.fn(),
  exchangeLongLivedToken: vi.fn(),
}))

vi.mock("@chatbotx.io/integration-instagram", () => ({
  exchangeCodeForToken: vi.fn(),
}))

vi.mock("@chatbotx.io/integration-instagram-facebook", () => ({
  exchangeCodeForToken: vi.fn(),
  getFacebookUser: vi.fn(),
}))

vi.mock("@chatbotx.io/integration-messenger", () => ({
  exchangeCodeForToken: vi.fn(),
  getFacebookUser: vi.fn(),
}))

vi.mock("@chatbotx.io/integration-messenger/apis/page", () => ({
  exchangeLongLivedToken: vi.fn(),
}))

vi.mock("@chatbotx.io/integration-meta-catalog/schemas", () => ({}))

vi.mock("@chatbotx.io/integration-threads", () => ({
  buildThreadsAuthValue: vi.fn((props) => ({
    authType: "custom",
    tokens: { accessToken: props.accessToken, expiresAt: props.expiresAt },
    metadata: {
      version: props.version,
      threadsUserId: props.threadsUserId,
      username: props.username,
    },
  })),
  exchangeCodeForToken: mockExchangeThreadsCode,
  getSafeErrorDetails: vi.fn((error) => ({
    code: error instanceof Error ? error.message : "error",
    httpStatusCode: 500,
    subCode: null,
    type: "error",
    message: error instanceof Error ? error.message : String(error),
  })),
  getThreadsProfile: mockGetThreadsProfile,
}))

vi.mock("@chatbotx.io/sdk", () => ({
  AuthType: { custom: "custom" },
}))

vi.mock("@chatbotx.io/utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@chatbotx.io/utils")>()
  return {
    ...actual,
    getPublicUrlFromRequest: (request: { url: string }) => request.url,
  }
})

vi.mock("next/navigation", () => ({
  notFound: mockNotFound,
  redirect: mockRedirect,
}))

vi.mock("@/env", () => ({
  isCloud: () => true,
}))

vi.mock("@/features/facebook-lead-ad-automation/lib/pages", () => ({
  enableLeadgenForWorkspacePages: vi.fn(),
}))

vi.mock("@/features/integration-instagram/actions/reconnect-callback", () => ({
  reconnectInstagramFacebookHandler: vi.fn(),
  reconnectInstagramHandler: vi.fn(),
}))

vi.mock("@/features/integration-messenger/actions/reconnect-callback", () => ({
  reconnectMessengerHandler: vi.fn(),
}))

vi.mock("@/features/integration-threads/libs/oauth", () => ({
  getThreadsOAuthStateCookie: mockGetThreadsOAuthStateCookie,
  clearThreadsOAuthStateCookie: mockClearThreadsOAuthStateCookie,
}))

vi.mock("@/features/integration-tiktok/actions/connect.action", () => ({
  connectTiktokHandler: vi.fn(),
}))

vi.mock("@/features/integration-zalo/actions/connect-zalo.action", () => ({
  connectZaloHandler: vi.fn(),
}))

vi.mock("@/integration", () => ({
  integrations: {
    threads: {},
  },
}))

vi.mock("@/lib/auth/utils", () => ({
  getCurrentUserId: mockGetCurrentUserId,
}))

vi.mock("@/lib/channel-reconnect", () => ({
  buildReconnectRedirectUrl: (
    referer: string,
    params: Record<string, string>,
  ) =>
    `${referer}${referer.includes("?") ? "&" : "?"}${new URLSearchParams({
      reconnect: params.status,
      ...(params.reason ? { reason: params.reason } : {}),
    }).toString()}`,
}))

vi.mock("@/lib/facebook-pending-auth", () => ({
  encryptAuth: vi.fn(),
  FB_INSTAGRAM_FACEBOOK_PENDING_AUTH_COOKIE: "igfb-pending-auth",
  FB_INSTAGRAM_PENDING_AUTH_COOKIE: "ig-pending-auth",
  FB_MESSENGER_PENDING_AUTH_COOKIE: "messenger-pending-auth",
  FB_PENDING_AUTH_MAX_AGE: 600,
}))

vi.mock("@/lib/log", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock("@/lib/oauth-broker", () => ({
  buildBrokerCallbackUrl: (path: string) => `https://broker.example.com${path}`,
}))

vi.mock("@/lib/oauth-referer", () => ({
  resolveRelayTarget: vi.fn(async () => null),
  sanitizeReferer: vi.fn(async (referer: string) => referer),
}))

vi.mock("@/lib/platform-credential-owner", () => ({
  resolveOwnerForWorkspace: vi.fn(async () => "owner-1"),
}))

const { handleCallback } = await import(
  "../src/app/integrations/[...integration]/callback"
)

const REFERER =
  "https://app.example.com/space/1/settings/channels?channel=threads"

const buildRequest = (searchParams: Record<string, string>) =>
  ({
    url: `https://app.example.com/integrations/threads/callback?${new URLSearchParams(
      searchParams,
    ).toString()}`,
  }) as unknown as NextRequest

const encodeState = (state: Record<string, unknown>) =>
  Buffer.from(JSON.stringify(state)).toString("base64")

describe("threads oauth callback", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetCurrentUserId.mockResolvedValue("user-1")
    mockFindWorkspaceById.mockResolvedValue({
      id: "1",
      ownerId: "owner-1",
      scheduledDeletionAt: null,
    })
    mockIsMember.mockResolvedValue(true)
    mockFindWorkspaceMember.mockResolvedValue({
      permissions: { superAdmin: true },
    })
    mockResolveForOwner.mockResolvedValue({
      config: {
        clientId: "client-1",
        clientSecret: "secret-1",
        version: "v1.0",
      },
    })
    mockGetAccessState.mockResolvedValue(null)
    mockGetThreadsOAuthStateCookie.mockResolvedValue({
      nonce: "nonce-1",
      workspaceId: "1",
    })
    mockExchangeThreadsCode.mockResolvedValue({
      accessToken: "token-1",
      expiresAt: "2026-08-14T00:00:00.000Z",
    })
    mockGetThreadsProfile.mockResolvedValue({
      id: "threads-user-1",
      username: "alice",
      name: "Alice",
    })
    mockFindThreadsByUserId.mockResolvedValue(null)
  })

  test("re-checks access after token exchange and skips connect when workspace becomes frozen", async () => {
    mockFindWorkspaceById
      .mockResolvedValueOnce({
        id: "1",
        ownerId: "owner-1",
        scheduledDeletionAt: null,
      })
      .mockResolvedValueOnce({
        id: "1",
        ownerId: "owner-1",
        scheduledDeletionAt: null,
      })
      .mockResolvedValueOnce({
        id: "1",
        ownerId: "owner-1",
        scheduledDeletionAt: "2026-08-13T10:00:00.000Z",
      })

    await handleCallback(
      "threads",
      buildRequest({
        code: "code-1",
        state: encodeState({
          workspaceId: "1",
          referer: REFERER,
          nonce: "nonce-1",
        }),
      }),
    )

    expect(mockExchangeThreadsCode).toHaveBeenCalledTimes(1)
    expect(mockGetThreadsProfile).toHaveBeenCalledTimes(1)
    expect(mockConnectThreads).not.toHaveBeenCalled()
    expect(mockRedirect).toHaveBeenCalledWith(
      "https://app.example.com/space/1/settings/channels?channel=threads&error=oauth_failed",
    )
  })

  test("re-checks super admin after token exchange and skips reconnect when permission is revoked", async () => {
    mockGetThreadsOAuthStateCookie.mockResolvedValue({
      nonce: "nonce-1",
      workspaceId: "1",
      reconnectIntegrationId: "5",
    })
    mockFindWorkspaceMember
      .mockResolvedValueOnce({ permissions: { superAdmin: true } })
      .mockResolvedValueOnce({ permissions: { superAdmin: true } })
      .mockResolvedValueOnce({ permissions: { superAdmin: false } })
    mockFindThreadsByIdForWorkspace.mockResolvedValue({
      id: "5",
      threadsUserId: "threads-user-1",
    })

    await handleCallback(
      "threads",
      buildRequest({
        code: "code-1",
        state: encodeState({
          workspaceId: "1",
          referer: REFERER,
          nonce: "nonce-1",
          reconnectIntegrationId: "5",
        }),
      }),
    )

    expect(mockReconnectThreads).not.toHaveBeenCalled()
    expect(mockRedirect).toHaveBeenCalledWith(
      `${REFERER}&reconnect=error&reason=failed`,
    )
  })
})
