import { describe, expect, test } from "vitest"
import { fbCommentPublicReplySchema } from "../src/partials/fb-comment-automation"

describe("fbCommentPublicReplySchema", () => {
  test("accepts one to ten public reply values", () => {
    const parsed = fbCommentPublicReplySchema.parse({
      type: "text",
      value: "First",
      values: ["First", "Second", "Third", "Fourth"],
    })

    expect(parsed.values).toEqual(["First", "Second", "Third", "Fourth"])
  })

  test("keeps legacy single-value replies valid", () => {
    expect(
      fbCommentPublicReplySchema.parse({
        type: "text",
        value: "Legacy",
      }),
    ).toEqual({
      type: "text",
      value: "Legacy",
    })
  })

  test("rejects more than ten reply values", () => {
    expect(() =>
      fbCommentPublicReplySchema.parse({
        type: "text",
        value: "First",
        values: Array.from({ length: 11 }, (_value, index) => `Reply ${index}`),
      }),
    ).toThrow()
  })
})
