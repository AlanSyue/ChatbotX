import { describe, expect, test } from "vitest"
import {
  buildLegacyStoryReplyJobId,
  resolveLegacyStoryReplyMid,
} from "../src/integration/story-reply"

describe("legacy story reply mid routing", () => {
  test("uses sourceId when it exists", () => {
    const mid = resolveLegacyStoryReplyMid({
      id: "message-1",
      sourceId: "source:1/with?opaque",
    })

    expect(mid).toBe("source:1/with?opaque")
    expect(buildLegacyStoryReplyJobId(mid)).toBe(
      "story-reply-auto-legacy-source%3A1%2Fwith%3Fopaque",
    )
  })

  test("falls back to message.id when sourceId is missing", () => {
    const mid = resolveLegacyStoryReplyMid({
      id: "message-1",
    })

    expect(mid).toBe("message-1")
    expect(buildLegacyStoryReplyJobId(mid)).toBe(
      "story-reply-auto-legacy-message-1",
    )
    expect(buildLegacyStoryReplyJobId(mid)).not.toContain("undefined")
  })
})
