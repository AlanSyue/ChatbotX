import { describe, expect, test } from "vitest"
import {
  getEditablePublicReplyState,
  getInitialPublicReplyValues,
} from "@/features/fb-comments/lib/public-reply"
import {
  createFbCommentRequest,
  updateFbCommentRequest,
} from "@/features/fb-comments/schema/action"
import {
  createIgCommentRequest,
  updateIgCommentRequest,
} from "@/features/ig-comments/schema/action"

const baseFbInput = {
  name: "Automation",
  type: "messenger" as const,
  folderId: undefined,
  post: { type: "all" as const, value: [] },
  privateReply: { type: "none" as const, value: null },
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

const baseIgInput = {
  ...baseFbInput,
  type: "instagram" as const,
}

describe("comment public reply form state", () => {
  test("FB create schema accepts non-text public replies without values", () => {
    const result = createFbCommentRequest.safeParse({
      ...baseFbInput,
      publicReply: { type: "none", value: null },
    })

    expect(result.success).toBe(true)
  })

  test("IG create schema accepts non-text public replies without values", () => {
    const result = createIgCommentRequest.safeParse({
      ...baseIgInput,
      publicReply: { type: "flow", value: "flow-1" },
    })

    expect(result.success).toBe(true)
  })

  test("FB update schema accepts AI public reply without values", () => {
    const result = updateFbCommentRequest.safeParse({
      publicReply: { type: "AIAgent", value: "agent-1" },
    })

    expect(result.success).toBe(true)
  })

  test("IG update schema accepts none public reply without values", () => {
    const result = updateIgCommentRequest.safeParse({
      publicReply: { type: "none", value: null },
    })

    expect(result.success).toBe(true)
  })

  test("text replies initialize at least one editor row from legacy value", () => {
    expect(
      getInitialPublicReplyValues({
        type: "text",
        value: "hello",
      }),
    ).toEqual(["hello"])
  })

  test("text replies initialize one empty row when no value exists yet", () => {
    expect(
      getInitialPublicReplyValues({
        type: "text",
        value: null,
      }),
    ).toEqual([""])
  })

  test("non-text replies keep values undefined", () => {
    expect(
      getInitialPublicReplyValues({
        type: "flow",
        value: "flow-1",
      }),
    ).toBeUndefined()
  })

  test("editing text reply keeps newly added empty rows", () => {
    expect(
      getEditablePublicReplyState({
        isFirstRun: false,
        previousType: "text",
        reply: {
          type: "text",
          value: "hello",
          values: ["hello", ""],
        },
      }),
    ).toEqual({
      value: "hello",
      values: ["hello", ""],
    })
  })

  test("switching from non-text to text initializes one empty row", () => {
    expect(
      getEditablePublicReplyState({
        isFirstRun: false,
        previousType: "flow",
        reply: {
          type: "text",
          value: "flow-1",
        },
      }),
    ).toEqual({
      value: "",
      values: [""],
    })
  })

  test("switching from text to non-text clears value and values", () => {
    expect(
      getEditablePublicReplyState({
        isFirstRun: false,
        previousType: "text",
        reply: {
          type: "flow",
          value: "legacy text",
          values: ["legacy text"],
        },
      }),
    ).toEqual({
      value: null,
      values: undefined,
    })
  })

  test("first edit mount preserves existing non-text value", () => {
    expect(
      getEditablePublicReplyState({
        isFirstRun: true,
        previousType: "AIAgent",
        reply: {
          type: "AIAgent",
          value: "agent-1",
        },
      }),
    ).toEqual({
      value: "agent-1",
      values: undefined,
    })
  })
})
