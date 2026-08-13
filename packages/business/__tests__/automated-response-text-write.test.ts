import { describe, expect, test } from "vitest"
import { getAutomatedResponseTextWrite } from "../src/automated-response/text-write"

describe("getAutomatedResponseTextWrite", () => {
  test("writes all new texts and keeps the first as the legacy text", () => {
    expect(
      getAutomatedResponseTextWrite({
        texts: ["First", "Second", "Third"],
      }),
    ).toEqual({
      text: "First",
      texts: ["First", "Second", "Third"],
    })
  })

  test("clears both text representations for flow mode", () => {
    expect(
      getAutomatedResponseTextWrite({
        flowId: "flow-1",
        text: "Legacy",
        texts: ["First", "Second"],
      }),
    ).toEqual({
      text: null,
      texts: [],
    })
  })

  test("copies a legacy text write into the new texts array", () => {
    expect(
      getAutomatedResponseTextWrite({
        text: "Legacy",
      }),
    ).toEqual({
      text: "Legacy",
      texts: ["Legacy"],
    })
  })

  test("leaves response columns untouched for unrelated partial updates", () => {
    expect(getAutomatedResponseTextWrite({})).toBeUndefined()
  })
})
