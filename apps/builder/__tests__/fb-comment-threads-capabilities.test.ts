import { describe, expect, test } from "vitest"
import {
  FB_COMMENT_CAPABILITY_ERRORS,
  validateThreadsCapabilities,
} from "../src/features/fb-comments/lib/capabilities"
import { createFbCommentRequest } from "../src/features/fb-comments/schema/action"

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

describe("Threads fb-comment capabilities", () => {
  test("accepts the reduced Threads capability set", () => {
    expect(createFbCommentRequest.safeParse(baseThreadsInput).success).toBe(
      true,
    )
  })

  test("reports every unsupported Threads capability on raw input", () => {
    const issues: Array<{ path: (string | number)[]; code: string }> = []

    validateThreadsCapabilities(
      {
        ...baseThreadsInput,
        post: { type: "published", value: ["post-1"] },
        privateReply: { type: "text", value: "DM" },
        publicReply: { type: "flow", value: "flow-1" },
        options: {
          ...baseThreadsInput.options,
          likeUserComment: true,
        },
        hideComments: {
          ...baseThreadsInput.hideComments,
          hasLink: true,
        },
      },
      (path, code) => {
        issues.push({ path, code })
      },
    )

    expect(issues).toEqual([
      {
        path: ["post", "type"],
        code: FB_COMMENT_CAPABILITY_ERRORS.threadsPostType,
      },
      {
        path: ["privateReply", "type"],
        code: FB_COMMENT_CAPABILITY_ERRORS.threadsPrivateReply,
      },
      {
        path: ["publicReply", "type"],
        code: FB_COMMENT_CAPABILITY_ERRORS.threadsPublicReply,
      },
      {
        path: ["options", "likeUserComment"],
        code: FB_COMMENT_CAPABILITY_ERRORS.threadsLike,
      },
      {
        path: ["hideComments"],
        code: FB_COMMENT_CAPABILITY_ERRORS.threadsHide,
      },
    ])
  })

  test("surfaces Threads capability errors through schema validation", () => {
    const result = createFbCommentRequest.safeParse({
      ...baseThreadsInput,
      privateReply: { type: "flow", value: "flow-1" },
    })

    expect(result.success).toBe(false)
    expect(result.error?.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: ["privateReply", "type"],
          message: FB_COMMENT_CAPABILITY_ERRORS.threadsPrivateReply,
        }),
      ]),
    )
  })
})
