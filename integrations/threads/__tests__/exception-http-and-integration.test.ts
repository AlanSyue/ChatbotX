import { AuthException } from "@chatbotx.io/sdk"
import { beforeEach, describe, expect, test, vi } from "vitest"

const graphGet = vi.fn()
const graphPost = vi.fn()
const refreshAccessToken = vi.fn()
const getThreadsProfile = vi.fn()
const webhookHandler = vi.fn()
const kyCreate = vi.fn(() => ({
  get: graphGet,
  post: graphPost,
}))

vi.mock("ky", () => ({
  HTTPError: class HTTPError extends Error {
    response: Response

    constructor(response: Response) {
      super("request failed")
      this.response = response
    }
  },
  default: {
    create: kyCreate,
  },
}))

vi.mock("../src/apis/auth", () => ({
  getThreadsProfile,
  refreshAccessToken,
}))

vi.mock("../src/handlers/webhook", () => ({
  webhookHandler,
}))

const { rescue, ThreadsException } = await import("../src/exception")
const { getSafeErrorDetails } = await import("../src/lib/error-sanitizer")
const { integration } = await import("../src/integration")

describe("threads exception, http client, and integration", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test("wraps unknown errors through rescue and sanitizes message", async () => {
    await expect(
      rescue("v1.0/user-1", () => {
        throw new Error("boom access_token=secret")
      }),
    ).rejects.toMatchObject({
      name: "ThreadsException",
      message: "Threads API error at v1.0/user-1: boom access_token=[REDACTED]",
    })
  })

  test("passes through existing ThreadsException", async () => {
    const error = new ThreadsException("already normalized")

    await expect(
      rescue("v1.0/user-1", () => {
        throw error
      }),
    ).rejects.toBe(error)
  })

  test("normalizes HTTPError response payload and parse failures", async () => {
    const { HTTPError } = await import("ky")
    const apiError = new HTTPError(
      new Response(
        JSON.stringify({
          error: {
            message: "bad client_secret=secret",
            code: 190,
            error_subcode: 463,
            type: "OAuthException",
          },
        }),
        { status: 401 },
      ),
    )

    await expect(
      rescue("v1.0/me", () => {
        throw apiError
      }),
    ).rejects.toMatchObject({
      message: "Threads API error at v1.0/me: bad client_secret=[REDACTED]",
      code: 190,
      subCode: 463,
      type: "OAuthException",
      httpStatusCode: 401,
      originError: apiError,
    })

    const invalidJsonError = new HTTPError(
      new Response("not-json", { status: 500 }),
    )
    await expect(
      rescue("v1.0/me", () => {
        throw invalidJsonError
      }),
    ).rejects.toMatchObject({
      message: "Threads API error at v1.0/me: request failed",
      httpStatusCode: 500,
      originError: invalidJsonError,
    })
  })

  test("returns safe error details for primitives", () => {
    expect(getSafeErrorDetails("client_secret=secret")).toEqual({
      message: "client_secret=[REDACTED]",
    })
  })

  test("builds ky clients and proxies get/post json responses", async () => {
    vi.resetModules()
    const graphJson = vi.fn(async () => ({ ok: true }))
    const oauthJson = vi.fn(async () => ({ created: true }))
    graphGet.mockReturnValueOnce({ json: graphJson })
    graphPost.mockReturnValueOnce({ json: oauthJson })
    const httpClientModule = await import("../src/lib/http-client")

    await expect(
      httpClientModule.threadsGraphClient.get("v1.0/me", {
        searchParams: { fields: "id" },
      }),
    ).resolves.toEqual({ ok: true })
    await expect(
      httpClientModule.threadsOAuthClient.post("oauth/access_token", {
        body: new URLSearchParams({ code: "123" }),
      }),
    ).resolves.toEqual({ created: true })

    expect(kyCreate).toHaveBeenCalledTimes(2)
    expect(graphGet).toHaveBeenCalledWith("v1.0/me", {
      searchParams: { fields: "id" },
    })
    expect(graphPost).toHaveBeenCalledWith("oauth/access_token", {
      body: new URLSearchParams({ code: "123" }),
    })
  })

  test("delegates getProfile and refreshAuth", async () => {
    getThreadsProfile.mockResolvedValueOnce({
      id: "user-1",
      username: "alice",
      name: "Alice",
    })
    refreshAccessToken.mockResolvedValueOnce({
      accessToken: "refreshed-token",
      expiresAt: "2026-08-12T00:00:00.000Z",
    })

    await expect(
      integration.actions.getProfile?.({
        ctx: {
          auth: {
            authType: "custom",
            tokens: { accessToken: "token-1" },
            metadata: { username: "alice", version: "v1.0" },
          },
        },
      } as never),
    ).resolves.toEqual({
      id: "user-1",
      username: "alice",
      name: "Alice",
    })

    await expect(
      integration.refreshAuth?.({
        auth: {
          authType: "custom",
          tokens: { accessToken: "token-1" },
          metadata: {
            threadsUserId: "user-1",
            username: "alice",
            version: "v1.0",
          },
        },
      } as never),
    ).resolves.toMatchObject({
      tokens: { accessToken: "refreshed-token" },
    })
  })

  test("rejects refreshAuth without access token", async () => {
    await expect(
      integration.refreshAuth?.({
        auth: {
          authType: "custom",
          tokens: {},
          metadata: {
            threadsUserId: "user-1",
            username: "alice",
            version: "v1.0",
          },
        },
      } as never),
    ).rejects.toBeInstanceOf(AuthException)
  })

  test("routes webhook requests and rejects unsupported actions", async () => {
    webhookHandler.mockResolvedValueOnce("ok")

    await expect(
      integration.handleRequest?.({
        req: new Request("https://example.com/api/threads/webhook", {
          method: "POST",
        }),
      } as never),
    ).resolves.toBe("ok")

    await expect(
      integration.handleRequest?.({
        req: new Request(
          "https://example.com/api/threads/unsupported?hub.verify_token=secret-token",
          {
            method: "POST",
          },
        ),
      } as never),
    ).rejects.toMatchObject({
      message: "POST /api/threads/unsupported is not implemented",
    })
  })

  test("disconnect is a no-op", async () => {
    await expect(integration.disconnect?.()).resolves.toBeUndefined()
  })
})
