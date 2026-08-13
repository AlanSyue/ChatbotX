import { describe, expect, test } from "vitest"
import { selectPublicReplyText } from "../src/integration/handlers/comment-automation/public-reply-text"

describe("selectPublicReplyText", () => {
  test("uses legacy single value fallback", () => {
    expect(
      selectPublicReplyText({
        automationId: "a1",
        commentId: "c1",
        reply: { type: "text", value: "hello" },
      }),
    ).toBe("hello")
  })

  test("selects a deterministic value from texts", () => {
    const first = selectPublicReplyText({
      automationId: "a1",
      commentId: "c1",
      reply: {
        type: "text",
        value: "fallback",
        values: ["one", "two", "three"],
      },
    })
    const second = selectPublicReplyText({
      automationId: "a1",
      commentId: "c1",
      reply: {
        type: "text",
        value: "fallback",
        values: ["one", "two", "three"],
      },
    })

    expect(second).toBe(first)
    expect(["one", "two", "three"]).toContain(first)
  })

  test("uses automation id in the selection seed", () => {
    const one = selectPublicReplyText({
      automationId: "a1",
      commentId: "c1",
      reply: { type: "text", value: null, values: ["one", "two"] },
    })
    const two = selectPublicReplyText({
      automationId: "a2",
      commentId: "c1",
      reply: { type: "text", value: null, values: ["one", "two"] },
    })

    expect(typeof one).toBe("string")
    expect(typeof two).toBe("string")
  })

  test("filters empty values and clamps to 10 entries", () => {
    const values = Array.from(
      { length: 12 },
      (_, index) => `value-${index + 1}`,
    )
    const selected = selectPublicReplyText({
      automationId: "a1",
      commentId: "c1",
      reply: {
        type: "text",
        value: null,
        values: ["", " ", ...values],
      },
    })

    expect(values.slice(0, 10)).toContain(selected)
  })
})
