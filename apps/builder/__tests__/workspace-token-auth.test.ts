import { describe, expect, test } from "vitest"
import { extractWorkspaceBearerToken } from "../src/middlewares/workspace-token"

describe("extractWorkspaceBearerToken", () => {
  test("accepts a Bearer token", () => {
    expect(
      extractWorkspaceBearerToken(
        new Headers({ Authorization: "Bearer workspace-secret" }),
      ),
    ).toBe("workspace-secret")
  })

  test("accepts a case-insensitive Bearer scheme and trims the token", () => {
    expect(
      extractWorkspaceBearerToken(
        new Headers({ Authorization: "bearer   workspace-secret  " }),
      ),
    ).toBe("workspace-secret")
  })

  test("rejects missing and non-Bearer authorization", () => {
    expect(extractWorkspaceBearerToken(new Headers())).toBeNull()
    expect(
      extractWorkspaceBearerToken(
        new Headers({ Authorization: "Basic workspace-secret" }),
      ),
    ).toBeNull()
  })
})
