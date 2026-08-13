// @vitest-environment node

import { beforeEach, describe, expect, test, vi } from "vitest"

const { disconnectSpy } = vi.hoisted(() => ({
  disconnectSpy: vi.fn(),
}))

vi.mock("@chatbotx.io/business", () => ({
  integrationThreadsService: {
    disconnect: disconnectSpy,
  },
}))

vi.mock("@chatbotx.io/business/errors", () => ({
  ChatbotXException: class ChatbotXException extends Error {
    readonly code: string
    readonly statusCode: number

    constructor(message: string, code: string, statusCode: number) {
      super(message)
      this.code = code
      this.statusCode = statusCode
    }
  },
}))

vi.mock("@chatbotx.io/utils", () => ({
  zodBigintAsString: vi.fn(),
}))

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async () => (key: string) => key),
}))

vi.mock("@/lib/safe-action", () => ({
  workspaceActionClientAllowExpired: {
    bindArgsSchemas: vi.fn(() => ({
      action: (handler: unknown) => handler,
    })),
  },
}))

const { disconnectThreadsAction } = await import(
  "../src/features/integration-threads/actions/disconnect-threads.action"
)

const runAction = disconnectThreadsAction as unknown as (args: {
  bindArgsParsedInputs: [string, string]
  ctx: { workspaceMemberPermissions?: { superAdmin?: boolean } }
}) => Promise<void>

describe("disconnectThreadsAction", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test("disconnects the Threads integration within the bound workspace", async () => {
    disconnectSpy.mockResolvedValue(true)

    await runAction({
      bindArgsParsedInputs: ["ws-1", "integration-1"],
      ctx: { workspaceMemberPermissions: { superAdmin: true } },
    })

    expect(disconnectSpy).toHaveBeenCalledWith({
      workspaceId: "ws-1",
      id: "integration-1",
    })
  })

  test("rejects non-super-admin members before disconnecting", async () => {
    await expect(
      runAction({
        bindArgsParsedInputs: ["ws-1", "integration-1"],
        ctx: { workspaceMemberPermissions: { superAdmin: false } },
      }),
    ).rejects.toThrow("workspace.schedule.permissionRequired")

    expect(disconnectSpy).not.toHaveBeenCalled()
  })
})
