import type { ChannelError } from "@chatbotx.io/sdk"
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
  createReplyContainer,
  getReplyCreationStatus,
  publishReplyContainer,
  sendCommentReply,
  waitForReplyContainerReady,
} = await import("../src/apis/comment")

const auth = {
  authType: "custom",
  tokens: { accessToken: "token-1" },
  metadata: { threadsUserId: "user-1", username: "alice", version: "v1.0" },
}

describe("threads comment api", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test("publishes comment reply after container finishes", async () => {
    graphPost.mockResolvedValueOnce({ id: "creation-1" })
    graphGet.mockResolvedValueOnce({ status: "FINISHED" })
    graphPost.mockResolvedValueOnce({ id: "published-1" })

    const result = await sendCommentReply(
      auth as never,
      "comment-1",
      "hello world",
      { sleep: async () => undefined },
    )

    expect(result).toEqual({ id: "published-1" })
  })

  test("throws when reply container reports error", async () => {
    graphGet.mockResolvedValueOnce({
      status: "ERROR",
      error_message: "denied",
    })

    await expect(
      waitForReplyContainerReady(auth as never, "creation-1", {
        sleep: async () => undefined,
      }),
    ).rejects.toThrow("denied")
  })

  test("uses auth metadata version and payload fields when creating and publishing", async () => {
    graphPost.mockResolvedValueOnce({ id: "creation-1" })
    graphGet.mockResolvedValueOnce({ status: "IN_PROGRESS" })
    graphPost.mockResolvedValueOnce({ id: "published-1" })

    await createReplyContainer(auth as never, "comment-1", "hello")
    await getReplyCreationStatus(auth as never, "creation-1")
    await publishReplyContainer(auth as never, "creation-1")

    expect(graphPost).toHaveBeenNthCalledWith(
      1,
      "v1.0/me/threads",
      expect.objectContaining({
        retry: 0,
      }),
    )
    expect(graphGet).toHaveBeenCalledWith(
      "v1.0/creation-1",
      expect.objectContaining({
        searchParams: expect.objectContaining({
          fields: "status,error_message",
        }),
      }),
    )
    expect(graphPost).toHaveBeenNthCalledWith(
      2,
      "v1.0/user-1/threads_publish",
      expect.objectContaining({
        retry: 0,
      }),
    )
  })

  test("rejects expired or unsupported statuses", async () => {
    graphGet.mockResolvedValueOnce({
      status: "EXPIRED",
      error_message: "expired",
    })
    await expect(
      waitForReplyContainerReady(auth as never, "creation-1", {
        sleep: async () => undefined,
      }),
    ).rejects.toThrow("expired")

    graphGet.mockResolvedValueOnce({ status: "QUEUED" })
    await expect(
      waitForReplyContainerReady(auth as never, "creation-2", {
        sleep: async () => undefined,
      }),
    ).rejects.toThrow("unsupported status")
  })

  test("times out while polling in-progress container", async () => {
    graphGet.mockResolvedValue({ status: "IN_PROGRESS" })

    await expect(
      waitForReplyContainerReady(auth as never, "creation-1", {
        timeoutMs: 10,
        pollIntervalMs: 5,
        now: vi
          .fn()
          .mockReturnValueOnce(0)
          .mockReturnValueOnce(0)
          .mockReturnValueOnce(10)
          .mockReturnValueOnce(10),
        sleep: async () => undefined,
      }),
    ).rejects.toThrow("did not finish within 10ms")
  })

  test("throws a non-retryable channel error when publish fails after container creation", async () => {
    graphPost.mockResolvedValueOnce({ id: "creation-1" })
    graphGet.mockResolvedValueOnce({ status: "FINISHED" })
    graphPost.mockRejectedValueOnce(new Error("publish 429"))

    await expect(
      sendCommentReply(auth as never, "comment-1", "hello world", {
        sleep: async () => undefined,
      }),
    ).rejects.toMatchObject({
      code: "threads_reply_publish_after_create_failed",
      isRetryable: false,
    } satisfies Partial<ChannelError>)
  })
})
