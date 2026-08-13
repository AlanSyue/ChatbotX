import { describe, expect, test } from "vitest"
import {
  getPublicReplyValues,
  normalizePublicReply,
} from "../src/features/fb-comments/lib/public-reply"
import { updateFbCommentRequest } from "../src/features/fb-comments/schema/action"

describe("FB comment public reply normalization", () => {
  test("still parses a partial update when platform is omitted", () => {
    const parsed = updateFbCommentRequest.parse({
      publicReply: {
        type: "text",
        value: "First",
        values: ["First", "Second"],
      },
    })

    expect(parsed.type).toBe("messenger")
    expect(parsed.publicReply).toEqual({
      type: "text",
      value: "First",
      values: ["First", "Second"],
    })
  })

  test("dual-writes the first configured reply for legacy readers", () => {
    expect(
      normalizePublicReply({
        type: "text",
        value: "Outdated",
        values: ["First", "Second", "Third"],
      }),
    ).toEqual({
      type: "text",
      value: "First",
      values: ["First", "Second", "Third"],
    })
  })

  test("loads a legacy single reply into the multi-reply editor", () => {
    expect(
      getPublicReplyValues({
        type: "text",
        value: "Legacy",
      }),
    ).toEqual(["Legacy"])
  })

  test("removes text values when switching to a non-text reply", () => {
    expect(
      normalizePublicReply({
        type: "flow",
        value: "flow-1",
        values: ["unused"],
      }),
    ).toEqual({
      type: "flow",
      value: "flow-1",
    })
  })
})
