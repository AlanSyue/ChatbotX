// @vitest-environment node

import { beforeEach, describe, expect, test, vi } from "vitest"
import z from "zod"

const { createSpy, findSpy, updateSpy } = vi.hoisted(() => ({
  createSpy: vi.fn(),
  findSpy: vi.fn(),
  updateSpy: vi.fn(),
}))

vi.mock("@chatbotx.io/business", () => ({
  fbCommentAutomationService: {
    create: createSpy,
    findByIdForWorkspace: findSpy,
    updateByIdForWorkspace: updateSpy,
  },
}))

vi.mock("@chatbotx.io/business/errors", () => ({
  ChatbotXException: class ChatbotXException extends Error {},
}))

vi.mock("@chatbotx.io/utils", () => ({
  createId: () => "automation-1",
  zodBigintAsString: () => z.string(),
}))

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async () => (key: string) => key),
}))

vi.mock("@/features/common/schemas", () => ({
  workspaceIdrequestParams: [],
}))

vi.mock("@/lib/safe-action", () => ({
  workspaceActionClient: {
    bindArgsSchemas: vi.fn(() => ({
      inputSchema: vi.fn(() => ({
        action: (handler: unknown) => handler,
      })),
    })),
  },
}))

const { createFbComment } = await import(
  "../src/features/fb-comments/actions/create-fb-comment.action"
)
const { updateFbComment } = await import(
  "../src/features/fb-comments/actions/update-fb-comment.action"
)

const baseThreadsInput = {
  name: "Threads automation",
  type: "threads" as const,
  folderId: null,
  post: { type: "postIds" as const, value: ["post-1"] },
  privateReply: { type: "none" as const, value: null },
  publicReply: {
    type: "text" as const,
    value: "Hello",
    values: ["Hello"],
  },
  includeKeywords: { type: "all" as const, value: [] },
  excludeKeywords: [],
  options: {
    replyToNewContactsOnly: false,
    replyOncePerUserPerPost: false,
    likeUserComment: false,
    replyToUsersWhoCommentedOnOtherPosts: true,
    ignoreCommentReplies: true,
    trackUserTags: false,
  },
  hideComments: {
    all: false,
    hasPhoneNumber: false,
    hasImage: false,
    hasVideo: false,
    hasLink: false,
    hasKeywords: false,
    keywords: [],
    showCommentsAfter: "none" as const,
  },
  replyAfter: { type: "immediately" as const, value: 0 },
}

describe("Threads fb-comment shared write paths", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createSpy.mockResolvedValue({ id: "automation-1" })
    updateSpy.mockResolvedValue({ id: "automation-1" })
  })

  test("rejects unsupported Threads create payloads before persistence", async () => {
    await expect(
      createFbComment("ws-1", {
        ...baseThreadsInput,
        privateReply: { type: "text", value: "DM" },
        publicReply: { type: "flow", value: "flow-1" },
      }),
    ).rejects.toThrow("messages.unknownError")

    expect(createSpy).not.toHaveBeenCalled()
  })

  test("normalizes allowed Threads create payloads before persistence", async () => {
    await createFbComment("ws-1", {
      ...baseThreadsInput,
      publicReply: {
        type: "text",
        value: "Stale",
        values: ["Hello", "Second"],
      },
    })

    expect(createSpy).toHaveBeenCalledWith({
      id: "automation-1",
      workspaceId: "ws-1",
      input: expect.objectContaining({
        type: "threads",
        publicReply: {
          type: "text",
          value: "Hello",
          values: ["Hello", "Second"],
        },
      }),
    })
  })

  test("merges existing Threads state before validating partial updates", async () => {
    findSpy.mockResolvedValue({
      ...baseThreadsInput,
      id: "automation-1",
      workspaceId: "ws-1",
      isActive: true,
      startTime: null,
      endTime: null,
      publicReply: { type: "flow", value: "legacy-flow" },
    })

    await expect(
      updateFbComment(
        { workspaceId: "ws-1", id: "automation-1" },
        { name: "Renamed only" },
      ),
    ).rejects.toThrow("messages.unknownError")

    expect(updateSpy).not.toHaveBeenCalled()
  })

  test("normalizes supported Threads updates after merged validation passes", async () => {
    findSpy.mockResolvedValue({
      ...baseThreadsInput,
      id: "automation-1",
      workspaceId: "ws-1",
      isActive: true,
      startTime: null,
      endTime: null,
    })

    await updateFbComment(
      { workspaceId: "ws-1", id: "automation-1" },
      {
        publicReply: {
          type: "text",
          value: "Stale",
          values: ["Updated", "Second"],
        },
      },
    )

    expect(updateSpy).toHaveBeenCalledWith({
      id: "automation-1",
      workspaceId: "ws-1",
      input: {
        publicReply: {
          type: "text",
          value: "Updated",
          values: ["Updated", "Second"],
        },
      },
    })
  })
})
