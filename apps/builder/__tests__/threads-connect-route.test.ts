// @vitest-environment node

import { NextRequest } from "next/server"
import { beforeEach, describe, expect, test, vi } from "vitest"

const {
  mockResolveForOwner,
  mockGetAccessState,
  mockFindWorkspaceById,
  mockGenerateThreadsRedirectUri,
  mockRequireWorkspacePermission,
  mockGetCurrentUserId,
  mockGetOriginUrlFromHeader,
  mockIsAllowedOrigin,
  mockResolveOwnerForWorkspace,
  mockRedirect,
  mockNotFound,
} = vi.hoisted(() => ({
  mockResolveForOwner: vi.fn(),
  mockGetAccessState: vi.fn(),
  mockFindWorkspaceById: vi.fn(),
  mockGenerateThreadsRedirectUri: vi.fn(
    async () => "https://threads.example/oauth",
  ),
  mockRequireWorkspacePermission: vi.fn(async () => undefined),
  mockGetCurrentUserId: vi.fn(async () => "user-1"),
  mockGetOriginUrlFromHeader: vi.fn(async () => "https://chat.acme.com"),
  mockIsAllowedOrigin: vi.fn(async () => true),
  mockResolveOwnerForWorkspace: vi.fn(async () => "owner-credential-1"),
  mockRedirect: vi.fn(),
  mockNotFound: vi.fn(() => {
    throw new Error("not found")
  }),
}))

vi.mock("@chatbotx.io/business", () => ({
  platformCredentialService: {
    resolveForOwner: mockResolveForOwner,
  },
  resolveWorkspaceFreezeReason: vi.fn(({ accessState }) =>
    accessState?.blocked ? "quotaBlocked" : null,
  ),
  userQuotaService: {
    getAccessState: mockGetAccessState,
  },
  workspaceService: {
    findById: mockFindWorkspaceById,
  },
}))

vi.mock("@chatbotx.io/utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@chatbotx.io/utils")>()
  return {
    ...actual,
    getPublicUrlFromRequest: vi.fn((request: Request) => request.url),
  }
})

vi.mock("next/navigation", () => ({
  notFound: mockNotFound,
  redirect: mockRedirect,
}))

vi.mock("@/env", () => ({
  isCloud: () => true,
}))

vi.mock("@/lib/auth/require-workspace-permission", () => ({
  requireWorkspacePermission: mockRequireWorkspacePermission,
}))

vi.mock("@/lib/auth/utils", () => ({
  getCurrentUserId: mockGetCurrentUserId,
}))

vi.mock("@/features/integration-threads/libs/oauth", () => ({
  generateThreadsRedirectUri: mockGenerateThreadsRedirectUri,
}))

vi.mock("@/lib/domain", () => ({
  getOriginUrlFromHeader: mockGetOriginUrlFromHeader,
}))

vi.mock("@/lib/oauth-referer", () => ({
  isAllowedOrigin: mockIsAllowedOrigin,
}))

vi.mock("@/lib/platform-credential-owner", () => ({
  resolveOwnerForWorkspace: mockResolveOwnerForWorkspace,
}))

const { GET } = await import(
  "../src/app/(no-sidebar)/channels/create/threads/route"
)

describe("threads connect route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFindWorkspaceById.mockResolvedValue({ id: "1", ownerId: "owner-1" })
    mockGetAccessState.mockResolvedValue({ blocked: false })
    mockGetCurrentUserId.mockResolvedValue("user-1")
    mockGetOriginUrlFromHeader.mockResolvedValue("https://chat.acme.com")
    mockIsAllowedOrigin.mockResolvedValue(true)
    mockResolveOwnerForWorkspace.mockResolvedValue("owner-credential-1")
    mockResolveForOwner.mockResolvedValue({
      publicConfig: { clientId: "threads-app-id" },
    })
  })

  test("gates the route by workspace owner quota before building the redirect", async () => {
    mockGetAccessState.mockResolvedValue({ blocked: true })

    await expect(
      GET(
        new NextRequest(
          "https://builder.example/channels/create/threads?workspaceId=1",
        ),
      ),
    ).rejects.toThrow("not found")

    expect(mockGetAccessState).toHaveBeenCalledWith("owner-1")
    expect(mockGenerateThreadsRedirectUri).not.toHaveBeenCalled()
  })

  test("rejects spoofed origins before generating the OAuth url", async () => {
    mockIsAllowedOrigin.mockResolvedValue(false)

    await expect(
      GET(
        new NextRequest(
          "https://builder.example/channels/create/threads?workspaceId=1",
        ),
      ),
    ).rejects.toThrow("not found")

    expect(mockGenerateThreadsRedirectUri).not.toHaveBeenCalled()
  })

  test("delegates to the Threads OAuth helper with the sanitized origin", async () => {
    await GET(
      new NextRequest(
        "https://builder.example/channels/create/threads?workspaceId=1",
      ),
    )

    expect(mockRequireWorkspacePermission).toHaveBeenCalledWith(
      "1",
      "superAdmin",
    )
    expect(mockGenerateThreadsRedirectUri).toHaveBeenCalledWith({
      publicConfig: { clientId: "threads-app-id" },
      workspaceId: "1",
      origin: "https://chat.acme.com",
    })
    expect(mockRedirect).toHaveBeenCalledWith("https://threads.example/oauth")
  })
})
