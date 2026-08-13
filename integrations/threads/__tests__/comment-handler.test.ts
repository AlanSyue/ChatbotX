import { ChannelError, ChannelErrorCategory } from "@chatbotx.io/sdk"
import { beforeEach, describe, expect, test, vi } from "vitest"

const sendCommentReply = vi.fn()
const loggerError = vi.fn()

vi.mock("../src/apis/comment", () => ({
  sendCommentReply,
}))

vi.mock("../src/lib/logger", () => ({
  logger: {
    error: loggerError,
  },
}))

const { commentHandlers } = await import("../src/handlers/comment")
const { sendComment } = await import("../src/handlers/comment/outgoing-comment")

describe("threads comment handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test("rejects missing replyToCommentId", async () => {
    await expect(
      sendComment({
        ctx: { auth: {} },
        data: {
          message: { text: "hello", contentAttributes: {} },
        },
      } as never),
    ).rejects.toMatchObject({
      category: ChannelErrorCategory.PAYLOAD_INVALID,
    })
  })

  test("rejects missing text", async () => {
    await expect(
      sendComment({
        ctx: { auth: {} },
        data: {
          message: {
            text: "  ",
            contentAttributes: { replyToCommentId: "comment-1" },
          },
        },
      } as never),
    ).rejects.toMatchObject({
      category: ChannelErrorCategory.PAYLOAD_INVALID,
    })
  })

  test("sends comment reply and returns published message id", async () => {
    sendCommentReply.mockResolvedValueOnce({ id: "reply-1" })

    await expect(
      sendComment({
        ctx: { auth: { tokens: { accessToken: "token-1" } } },
        data: {
          message: {
            text: "hello",
            contentAttributes: { replyToCommentId: "comment-1" },
          },
        },
      } as never),
    ).resolves.toEqual({ messageIds: ["reply-1"] })
  })

  test("maps provider failures and logs sanitized details", async () => {
    sendCommentReply.mockRejectedValueOnce(
      new ChannelError(
        "boom access_token=secret",
        ChannelErrorCategory.UNKNOWN,
      ),
    )

    await expect(
      sendComment({
        ctx: { auth: { tokens: { accessToken: "token-1" } } },
        data: {
          message: {
            text: "hello",
            contentAttributes: { replyToCommentId: "comment-1" },
          },
        },
      } as never),
    ).rejects.toMatchObject({
      category: ChannelErrorCategory.UNKNOWN,
    })

    expect(loggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        replyToCommentId: "comment-1",
        channelErrorCategory: ChannelErrorCategory.UNKNOWN,
      }),
      "Failed to send Threads comment reply",
    )
  })

  test("exposes unsupported comment actions as explicit unsupported errors", () => {
    const actions = [
      () => commentHandlers.deleteComment(),
      () => commentHandlers.editComment(),
      () => commentHandlers.likeComment(),
      () => commentHandlers.hideComment(),
    ]

    for (const run of actions) {
      try {
        run()
      } catch (error) {
        expect(error).toMatchObject({
          category: ChannelErrorCategory.PERMISSION_DENIED,
          code: "threads_comment_action_unsupported",
        })
      }
    }
  })
})
