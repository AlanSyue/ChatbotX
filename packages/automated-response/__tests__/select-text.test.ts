import { describe, expect, test } from "vitest"
import { selectAutomatedResponseText } from "../src/select-text"

describe("selectAutomatedResponseText", () => {
  test("returns a deterministic item from texts when provided", () => {
    expect(
      selectAutomatedResponseText(
        {
          text: "Legacy",
          texts: ["First", "Second", "Third"],
        },
        () => 0.4,
      ),
    ).toBe("Second")
  })

  test("falls back to the legacy text when texts is empty", () => {
    expect(
      selectAutomatedResponseText({
        text: "Legacy",
        texts: [],
      }),
    ).toBe("Legacy")
  })

  test("ignores empty texts before picking a reply", () => {
    expect(
      selectAutomatedResponseText(
        {
          text: "Legacy",
          texts: ["", "Actual"],
        },
        () => 0,
      ),
    ).toBe("Actual")
  })
})
