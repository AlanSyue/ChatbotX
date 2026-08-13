import { describe, expect, test } from "vitest"
import { threadsCredentialUpdateSchema } from "../src/partials/credential"

describe("threadsCredentialUpdateSchema", () => {
  test("allows blank client secret for existing settings edits", () => {
    const parsed = threadsCredentialUpdateSchema.safeParse({
      clientId: "client-id",
      version: "v1.0",
      verifyToken: "verify-token",
      clientSecret: "",
    })

    expect(parsed.success).toBe(true)
  })

  test("requires public fields", () => {
    const parsed = threadsCredentialUpdateSchema.safeParse({
      clientId: "",
      version: "v1.0",
      verifyToken: "verify-token",
      clientSecret: "",
    })

    expect(parsed.success).toBe(false)
  })
})
