import { ChannelError, ChannelErrorCategory } from "@chatbotx.io/sdk"
import { describe, expect, test, vi } from "vitest"

const { sanitizeSensitiveText } = await import("../src/lib/error-sanitizer")
const { ThreadsException } = await import("../src/exception")
const { mapToChannelError, isRevokedTokenError } = await import(
  "../src/lib/error-mapper"
)
vi.mock("../src/apis/auth", () => ({
  getThreadsProfile: vi.fn(async () => ({
    id: "user-1",
    username: "alice",
    name: "alice",
  })),
  refreshAccessToken: vi.fn(async () => ({
    accessToken: "refreshed-token",
    expiresAt: "2026-08-12T00:00:00.000Z",
  })),
}))
const { integration } = await import("../src/integration")

describe("threads error handling and integration", () => {
  test("sanitizes tokens from urls and assignments", () => {
    const text =
      'https://example.com?access_token=abc client_secret="def" refresh_token=ghi'

    expect(sanitizeSensitiveText(text)).not.toContain("abc")
    expect(sanitizeSensitiveText(text)).not.toContain("def")
    expect(sanitizeSensitiveText(text)).not.toContain("ghi")
  })

  test("maps auth failures to channel auth category", () => {
    const error = new ThreadsException("bad token", {
      code: 190,
      subCode: 463,
      httpStatusCode: 401,
      type: "OAuthException",
    })

    const mapped = mapToChannelError(error)
    expect(mapped.category).toBe(ChannelErrorCategory.AUTH_FAILED)
    expect(isRevokedTokenError(error)).toBe(true)
  })

  test("maps category matrix and default http statuses", () => {
    const cases = [
      {
        error: new ThreadsException("quota", { code: 2_207_042 }),
        category: ChannelErrorCategory.QUOTA_EXCEEDED,
        httpStatusCode: 429,
      },
      {
        error: new ThreadsException("rate", { code: 4 }),
        category: ChannelErrorCategory.RATE_LIMITED,
        httpStatusCode: 429,
      },
      {
        error: new ThreadsException("permission", { code: 341 }),
        category: ChannelErrorCategory.PERMISSION_DENIED,
        httpStatusCode: 403,
      },
      {
        error: new ThreadsException("permission", { code: 250 }),
        category: ChannelErrorCategory.PERMISSION_DENIED,
        httpStatusCode: 403,
      },
      {
        error: new ThreadsException("network", { code: 2 }),
        category: ChannelErrorCategory.NETWORK_ERROR,
        httpStatusCode: 503,
      },
      {
        error: new ThreadsException("payload", { code: 33 }),
        category: ChannelErrorCategory.PAYLOAD_INVALID,
        httpStatusCode: 400,
      },
      {
        error: new ThreadsException("rate", { httpStatusCode: 429 }),
        category: ChannelErrorCategory.RATE_LIMITED,
        httpStatusCode: 429,
      },
      {
        error: new ThreadsException("server", { httpStatusCode: 503 }),
        category: ChannelErrorCategory.NETWORK_ERROR,
        httpStatusCode: 503,
      },
      {
        error: new ThreadsException("did not finish within 10ms"),
        category: ChannelErrorCategory.NETWORK_ERROR,
        httpStatusCode: 503,
      },
      {
        error: new ThreadsException("unknown"),
        category: ChannelErrorCategory.UNKNOWN,
        httpStatusCode: 400,
      },
    ] as const

    for (const { error, category, httpStatusCode } of cases) {
      const mapped = mapToChannelError(error)
      expect(mapped.category).toBe(category)
      expect(mapped.httpStatusCode).toBe(httpStatusCode)
    }
  })

  test("passes through ChannelError and handles non-Threads errors", () => {
    const passthrough = new ChannelError(
      "keep me",
      ChannelErrorCategory.UNKNOWN,
    )
    expect(mapToChannelError(passthrough)).toBe(passthrough)

    const mapped = mapToChannelError(new Error("client_secret=secret"))
    expect(mapped.category).toBe(ChannelErrorCategory.UNKNOWN)
    expect(mapped.message).toContain("[REDACTED]")
  })

  test("exposes comment channel and refreshAuth", async () => {
    expect(integration.name).toBe("threads")
    expect(integration.channels.channel.comment).toBeTruthy()
    expect(
      await integration.refreshAuth?.({
        auth: {
          authType: "custom",
          tokens: { accessToken: "token-1" },
          metadata: {
            threadsUserId: "user-1",
            username: "alice",
            version: "v1.0",
          },
        } as never,
      } as never),
    ).toMatchObject({
      tokens: { accessToken: "refreshed-token" },
    })
  })

  test("normalizes unknown errors through channel mapping", () => {
    const mapped = mapToChannelError(
      new ThreadsException("wrapper access_token=secret", {
        httpStatusCode: 400,
      }),
    )
    expect(mapped.category).toBe(ChannelErrorCategory.UNKNOWN)
    expect(mapped.message).not.toContain("secret")
  })

  test("detects non-revoked token cases", () => {
    expect(isRevokedTokenError(new Error("x"))).toBe(false)
    expect(
      isRevokedTokenError(
        new ThreadsException("bad token", {
          code: 190,
          subCode: 459,
          httpStatusCode: 401,
        }),
      ),
    ).toBe(false)
  })
})
