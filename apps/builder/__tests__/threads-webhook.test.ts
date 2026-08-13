// @vitest-environment node

import { NextRequest } from "next/server"
import { beforeEach, describe, expect, test, vi } from "vitest"

const {
  mockFindThreadsCredentialByClientId,
  mockHandleRequest,
  mockWarn,
  mockGetSafeErrorDetails,
} = vi.hoisted(() => ({
  mockFindThreadsCredentialByClientId: vi.fn(),
  mockHandleRequest: vi.fn(),
  mockWarn: vi.fn(),
  mockGetSafeErrorDetails: vi.fn(),
}))

vi.mock("@chatbotx.io/business", () => ({
  customDomainService: { findActiveByDomain: vi.fn() },
  platformCredentialService: {
    findThreadsCredentialByClientId: mockFindThreadsCredentialByClientId,
    resolveForOwner: vi.fn(),
    findDecryptedPlatform: vi.fn(),
    findDecryptedForUser: vi.fn(),
  },
  resolveWorkspaceFreezeReason: vi.fn(),
  tenantService: { findById: vi.fn() },
  userQuotaService: { getAccessState: vi.fn() },
  workspaceService: { find: vi.fn() },
}))

vi.mock("@chatbotx.io/database/client", () => ({
  db: {},
  eq: vi.fn(),
}))

vi.mock("@chatbotx.io/database/partials", () => ({
  inboxStatuses: { enum: {} },
}))

vi.mock("@chatbotx.io/database/schema", () => ({
  inboxModel: {},
}))

vi.mock("@chatbotx.io/integration-threads", () => ({
  getSafeErrorDetails: (error: unknown) => mockGetSafeErrorDetails(error),
}))

vi.mock("@chatbotx.io/worker-config", () => ({
  integrationQueue: {},
}))

vi.mock("@/integration", () => ({
  integrations: {
    threads: {
      name: "threads",
      handleRequest: (args: unknown) => mockHandleRequest(args),
    },
  },
}))

vi.mock("@/lib/log", () => ({
  logger: {
    info: vi.fn(),
    warn: mockWarn,
    debug: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock("@/lib/oauth-broker", () => ({
  isBrokerHost: vi.fn(() => true),
}))

vi.mock("@/env", () => ({
  isCloud: () => false,
}))

vi.mock("@/features/integration-telegram/queries", () => ({
  findIntegrationTelegramByBotId: vi.fn(),
}))

vi.mock("@/features/integration-tiktok/queries", () => ({
  findIntegrationTiktokByOpenId: vi.fn(),
}))

const { handleWebhook } = await import(
  "../src/app/integrations/[...integration]/webhook"
)

describe("threads webhook handler", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFindThreadsCredentialByClientId.mockImplementation(
      async ({ clientId }: { clientId: string }) => ({
        config: {
          clientId,
          clientSecret: `threads-secret-${clientId}`,
          verifyToken: "verify-token",
        },
      }),
    )
    mockGetSafeErrorDetails.mockImplementation((error: unknown) => ({
      code: "error",
      httpStatusCode: 400,
      subCode: null,
      type: "error",
      message: error instanceof Error ? error.message : String(error),
    }))
  })

  test("rejects requests without appId", async () => {
    const response = await handleWebhook(
      "threads",
      new NextRequest("https://broker.example/integrations/threads/webhook"),
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      message: "Invalid request",
    })
  })

  test("resolves the credential by appId and forwards the request", async () => {
    mockHandleRequest.mockResolvedValue("ok")

    const response = await handleWebhook(
      "threads",
      new NextRequest(
        "https://broker.example/integrations/threads/webhook?appId=threads-app-id",
        {
          method: "POST",
          body: JSON.stringify({ hello: "world" }),
        },
      ),
    )

    expect(mockFindThreadsCredentialByClientId).toHaveBeenCalledWith({
      clientId: "threads-app-id",
    })
    expect(mockHandleRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({
          clientId: "threads-app-id",
          redirectUrl: "https://broker.example/integrations/threads/callback",
        }),
      }),
    )
    expect(response.status).toBe(200)
  })

  test("returns a clamped 400 on signature failures without leaking secrets", async () => {
    mockHandleRequest.mockRejectedValue(new Error("invalid signature"))
    mockGetSafeErrorDetails.mockReturnValue({
      code: "signature",
      httpStatusCode: 400,
      subCode: null,
      type: "error",
      message: "Invalid webhook signature [REDACTED]",
    })

    const response = await handleWebhook(
      "threads",
      new NextRequest(
        "https://broker.example/integrations/threads/webhook?appId=threads-app-id",
        {
          method: "POST",
          body: "{}",
        },
      ),
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      message: "Invalid request",
    })
    expect(mockWarn).toHaveBeenCalledWith(
      expect.objectContaining({
        appId: "threads-app-id",
        errorMessage: "Invalid webhook signature [REDACTED]",
      }),
      "Threads webhook request failed",
    )
    expect(JSON.stringify(mockWarn.mock.calls)).not.toContain("threads-secret")
  })
})
