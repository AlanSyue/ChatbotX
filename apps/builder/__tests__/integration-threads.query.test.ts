// @vitest-environment node

import { beforeEach, describe, expect, test, vi } from "vitest"

const listPublicByWorkspaceId = vi.fn()

vi.mock("@chatbotx.io/business", () => ({
  integrationThreadsService: {
    listPublicByWorkspaceId,
  },
}))

const { listIntegrationThreads } = await import(
  "../src/features/integration-threads/queries"
)

describe("listIntegrationThreads", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listPublicByWorkspaceId.mockResolvedValue({
      data: [
        {
          id: "integration-1",
          workspaceId: "ws-1",
          inboxId: "inbox-1",
          threadsUserId: "threads-user-1",
          username: "alice",
          name: "Alice",
        },
      ],
    })
  })

  test("delegates to the public Threads query and returns only public columns", async () => {
    const result = await listIntegrationThreads({ workspaceId: "ws-1" })

    expect(listPublicByWorkspaceId).toHaveBeenCalledWith({
      workspaceId: "ws-1",
    })
    expect(JSON.stringify(result)).not.toContain("auth")
    expect(JSON.stringify(result)).not.toContain("accessToken")
    expect(JSON.stringify(result)).not.toContain("clientSecret")
  })
})
