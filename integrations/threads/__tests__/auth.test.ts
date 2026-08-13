import { beforeEach, describe, expect, test, vi } from "vitest"

const graphGet = vi.fn()
const graphPost = vi.fn()

vi.mock("../src/lib/http-client", () => ({
  threadsGraphClient: {
    get: graphGet,
    post: graphPost,
  },
}))

const {
  generateAuthUrl,
  exchangeCodeForToken,
  refreshAccessToken,
  getThreadsProfile,
  buildThreadsAuthValue,
} = await import("../src/apis/auth")

describe("threads auth api", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test("builds oauth authorize url with encoded state", () => {
    const url = new URL(
      generateAuthUrl({
        clientId: "app-1",
        redirectUrl: "https://example.com/callback",
        stateParams: { workspaceId: "1" },
      }),
    )

    expect(url.origin).toBe("https://threads.net")
    expect(url.pathname).toBe("/oauth/authorize")
    expect(url.searchParams.get("client_id")).toBe("app-1")
    expect(url.searchParams.get("scope")).toContain("threads_basic")
    expect(url.searchParams.get("scope")).toContain("threads_manage_replies")
  })

  test("exchanges code then long-lived token", async () => {
    graphPost.mockResolvedValueOnce({ access_token: "short-token" })
    graphGet.mockResolvedValueOnce({
      access_token: "long-token",
      expires_in: 3600,
    })

    const result = await exchangeCodeForToken(
      {
        clientId: "app-1",
        clientSecret: "secret-1",
      },
      "code-1",
      "https://example.com/callback",
    )

    expect(result.accessToken).toBe("long-token")
    expect(result.expiresAt).toBeTruthy()
  })

  test("refreshes long-lived token", async () => {
    graphGet.mockResolvedValueOnce({
      access_token: "refreshed-token",
      expires_in: 1800,
    })

    const result = await refreshAccessToken({ accessToken: "old-token" })

    expect(result.accessToken).toBe("refreshed-token")
    expect(result.expiresAt).toBeTruthy()
  })

  test("reads profile and normalizes name from username", async () => {
    graphGet.mockResolvedValueOnce({
      id: "user-1",
      username: "alice",
      threads_profile_picture_url: "https://img.example/avatar.png",
    })

    const result = await getThreadsProfile("token-1")

    expect(result).toEqual({
      id: "user-1",
      username: "alice",
      name: "alice",
      threads_profile_picture_url: "https://img.example/avatar.png",
    })
  })

  test("builds custom auth value without platform secrets", () => {
    const auth = buildThreadsAuthValue({
      accessToken: "token-1",
      threadsUserId: "user-1",
      username: "alice",
    })

    expect(auth).toMatchObject({
      authType: "custom",
      tokens: { accessToken: "token-1" },
      metadata: { threadsUserId: "user-1", username: "alice" },
    })
    expect(JSON.stringify(auth)).not.toContain("clientSecret")
    expect(JSON.stringify(auth)).not.toContain("redirectUrl")
    expect(JSON.stringify(auth)).not.toContain("clientId")
  })
})
