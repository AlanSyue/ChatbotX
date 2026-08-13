// @vitest-environment node
import { beforeEach, describe, expect, test, vi } from "vitest"

const { findDecryptedSpy, findSpy, resolveSpy, upsertSpy } = vi.hoisted(() => ({
  findDecryptedSpy: vi.fn(),
  findSpy: vi.fn(),
  resolveSpy: vi.fn(),
  upsertSpy: vi.fn(),
}))

vi.mock("@/lib/safe-action", () => {
  const chain: Record<string, any> = {}
  chain.bindArgsSchemas = () => chain
  chain.inputSchema = () => chain
  chain.action = (handler: unknown) => handler
  return { authActionClient: chain }
})

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async () => (key: string) => {
    if (key === "platformSettings.errors.threadsAppSecretRequired") {
      return "Threads App Secret is required."
    }
    return key
  }),
}))

vi.mock("@chatbotx.io/business", () => ({
  platformCredentialService: {
    find: findSpy,
    findDecrypted: findDecryptedSpy,
    upsert: upsertSpy,
  },
}))

vi.mock("../src/features/platform-credentials/scope", () => ({
  credentialScopeSchema: {},
  resolveCredentialScopedUserId: resolveSpy,
}))

const { updateThreadsSettingAction } = await import(
  "../src/features/platform-credentials/threads/update-threads-settings.action"
)

const call = (action: unknown) => action as (args: any) => Promise<unknown>

describe("Threads credential actions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resolveSpy.mockReturnValue("user-1")
  })

  test("upserts all fields", async () => {
    findSpy.mockResolvedValue(undefined)

    await call(updateThreadsSettingAction)({
      ctx: { user: { id: "user-1" } },
      bindArgsParsedInputs: ["user"],
      parsedInput: {
        clientId: "id",
        version: "v1.0",
        verifyToken: "verify",
        clientSecret: "secret",
      },
    })

    expect(upsertSpy).toHaveBeenCalledWith({
      userId: "user-1",
      type: "threads",
      config: {
        clientId: "id",
        version: "v1.0",
        verifyToken: "verify",
        clientSecret: "secret",
      },
    })
  })

  test("reuses the existing own secret when editing with blank secret", async () => {
    findSpy.mockResolvedValue({
      userId: "user-1",
      usePlatformCredential: false,
    })
    findDecryptedSpy.mockResolvedValue({
      config: { clientSecret: "kept-secret" },
    })

    await call(updateThreadsSettingAction)({
      ctx: { user: { id: "user-1" } },
      bindArgsParsedInputs: ["user"],
      parsedInput: {
        clientId: "id",
        version: "v1.0",
        verifyToken: "verify",
        clientSecret: "",
      },
    })

    expect(findDecryptedSpy).toHaveBeenCalledWith({
      userId: "user-1",
      type: "threads",
    })
    expect(upsertSpy).toHaveBeenCalledWith({
      userId: "user-1",
      type: "threads",
      config: {
        clientId: "id",
        version: "v1.0",
        verifyToken: "verify",
        clientSecret: "kept-secret",
      },
    })
  })

  test("rejects blank secret when the visible config is inherited", async () => {
    findSpy.mockResolvedValue({
      userId: "user-1",
      usePlatformCredential: true,
    })

    await expect(
      call(updateThreadsSettingAction)({
        ctx: { user: { id: "user-1" } },
        bindArgsParsedInputs: ["user"],
        parsedInput: {
          clientId: "platform-id",
          version: "v1.0",
          verifyToken: "verify",
          clientSecret: "",
        },
      }),
    ).rejects.toThrow("Threads App Secret is required.")

    expect(findDecryptedSpy).not.toHaveBeenCalled()
    expect(upsertSpy).not.toHaveBeenCalled()
  })
})
