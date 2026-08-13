import { beforeEach, describe, expect, test, vi } from "vitest"

type RouteConfig = {
  method: string
  path: string
  summary: string
  tags: string[]
  successStatus?: number
}

type CapturedProcedure = {
  route: RouteConfig
  handler?: (...args: any[]) => any
  useCalls: unknown[][]
}

const {
  authorizedAPI,
  workspaceTokenAuthAPI,
  capturedAuthorizedProcedures,
  capturedWorkspaceTokenProcedures,
  workspaceAuthorizedMidddleware,
  mocks,
} = vi.hoisted(() => {
  const capturedAuthorizedProcedures: CapturedProcedure[] = []
  const capturedWorkspaceTokenProcedures: CapturedProcedure[] = []

  const makeChain = (
    config: RouteConfig,
    bucket: CapturedProcedure[],
    supportsUse: boolean,
  ) => {
    const record: CapturedProcedure = { route: config, useCalls: [] }
    bucket.push(record)

    const chain = {
      input: vi.fn(() => chain),
      output: vi.fn(() => chain),
      errors: vi.fn(() => chain),
      use: vi.fn((...args: unknown[]) => {
        record.useCalls.push(args)
        return chain
      }),
      handler: vi.fn((fn: (...args: any[]) => any) => {
        record.handler = fn
        return { handler: fn }
      }),
    }

    if (!supportsUse) {
      ;(chain as { use?: unknown }).use = undefined
    }

    return chain
  }

  return {
    authorizedAPI: {
      route: vi.fn((config: RouteConfig) =>
        makeChain(config, capturedAuthorizedProcedures, true),
      ),
    },
    workspaceTokenAuthAPI: {
      route: vi.fn((config: RouteConfig) =>
        makeChain(config, capturedWorkspaceTokenProcedures, false),
      ),
    },
    capturedAuthorizedProcedures,
    capturedWorkspaceTokenProcedures,
    workspaceAuthorizedMidddleware: vi.fn(),
    mocks: {
      listStoryReplyAutomations: vi.fn(),
      createStoryReplyAutomation: vi.fn(),
      updateStoryReplyAutomation: vi.fn(),
      deleteStoryReplyAutomation: vi.fn(),
      findStoryReplyAutomationForWorkspace: vi.fn(),
      listStoryReplyAutomationsForWorkspace: vi.fn(),
      listInstagramAutomationStories: vi.fn(),
      listFacebookAutomationStories: vi.fn(),
    },
  }
})

vi.mock("@/orpc", () => ({
  authorizedAPI,
  workspaceTokenAuthAPI,
}))

vi.mock("@/middlewares/auth", () => ({
  workspaceAuthorizedMidddleware,
}))

vi.mock(
  "@/features/story-reply-automation/actions/create-story-reply-automation.action",
  () => ({
    createStoryReplyAutomation: mocks.createStoryReplyAutomation,
  }),
)
vi.mock(
  "@/features/story-reply-automation/actions/update-story-reply-automation.action",
  () => ({
    updateStoryReplyAutomation: mocks.updateStoryReplyAutomation,
  }),
)
vi.mock(
  "@/features/story-reply-automation/actions/delete-story-reply-automation.action",
  () => ({
    deleteStoryReplyAutomation: mocks.deleteStoryReplyAutomation,
  }),
)
vi.mock("@/features/story-reply-automation/queries", () => ({
  listStoryReplyAutomations: mocks.listStoryReplyAutomations,
  findStoryReplyAutomationForWorkspace:
    mocks.findStoryReplyAutomationForWorkspace,
  listStoryReplyAutomationsForWorkspace:
    mocks.listStoryReplyAutomationsForWorkspace,
}))
vi.mock("@/features/story-reply-automation/queries/instagram-stories", () => ({
  listInstagramAutomationStories: mocks.listInstagramAutomationStories,
}))
vi.mock("@/features/story-reply-automation/queries/facebook-stories", () => ({
  listFacebookAutomationStories: mocks.listFacebookAutomationStories,
}))

await import("@/features/story-reply-automation/api/authenticated")
await import("@/features/story-reply-automation/api/workspace-token")

const findAuthorizedProcedure = (method: string, path: string) => {
  const found = capturedAuthorizedProcedures.find(
    (item) => item.route.method === method && item.route.path === path,
  )
  if (!found) {
    throw new Error(`No authenticated procedure for ${method} ${path}`)
  }
  return found
}

const findWorkspaceTokenProcedure = (method: string, path: string) => {
  const found = capturedWorkspaceTokenProcedures.find(
    (item) => item.route.method === method && item.route.path === path,
  )
  if (!found) {
    throw new Error(`No workspace-token procedure for ${method} ${path}`)
  }
  return found
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("story reply automation authenticated API", () => {
  test("binds workspace authorization middleware to the workspaceId input", () => {
    const procedure = findAuthorizedProcedure(
      "POST",
      "/workspaces/{workspaceId}/story-reply-automation",
    )

    expect(procedure.useCalls).toHaveLength(1)
    const [middleware, mapper] = procedure.useCalls[0] as [
      unknown,
      (input: { workspaceId: string }) => string,
    ]
    expect(middleware).toBe(workspaceAuthorizedMidddleware)
    expect(mapper({ workspaceId: "workspace-1" })).toBe("workspace-1")
  })

  test("delegates list requests with the authenticated workspace input", async () => {
    const procedure = findAuthorizedProcedure(
      "GET",
      "/workspaces/{workspaceId}/story-reply-automation",
    )
    mocks.listStoryReplyAutomations.mockResolvedValueOnce({
      data: [{ id: "story-1" }],
      pageCount: 1,
    })

    await expect(
      procedure.handler?.({
        input: { workspaceId: "workspace-1", page: 1, perPage: 10 },
      }),
    ).resolves.toEqual({
      data: [{ id: "story-1" }],
      pageCount: 1,
    })

    expect(mocks.listStoryReplyAutomations).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      page: 1,
      perPage: 10,
    })
  })

  test("delegates story picker requests to the matching workspace-scoped query", async () => {
    const instagramProcedure = findAuthorizedProcedure(
      "GET",
      "/workspaces/{workspaceId}/story-reply-automation/instagram-stories",
    )
    const facebookProcedure = findAuthorizedProcedure(
      "GET",
      "/workspaces/{workspaceId}/story-reply-automation/facebook-stories",
    )
    mocks.listInstagramAutomationStories.mockResolvedValueOnce([
      { id: "ig-story-1" },
    ])
    mocks.listFacebookAutomationStories.mockResolvedValueOnce([
      { id: "fb-story-1" },
    ])

    await expect(
      instagramProcedure.handler?.({ input: { workspaceId: "workspace-1" } }),
    ).resolves.toEqual([{ id: "ig-story-1" }])
    await expect(
      facebookProcedure.handler?.({ input: { workspaceId: "workspace-1" } }),
    ).resolves.toEqual([{ id: "fb-story-1" }])

    expect(mocks.listInstagramAutomationStories).toHaveBeenCalledWith(
      "workspace-1",
    )
    expect(mocks.listFacebookAutomationStories).toHaveBeenCalledWith(
      "workspace-1",
    )
  })
})

describe("story reply automation workspace-token API", () => {
  test("lists automations from the token workspace and ignores a forged input workspaceId", async () => {
    const procedure = findWorkspaceTokenProcedure(
      "GET",
      "/v1/story-reply-automation",
    )
    mocks.listStoryReplyAutomationsForWorkspace.mockResolvedValueOnce({
      data: [{ id: "story-1" }],
      pageCount: 1,
    })

    await expect(
      procedure.handler?.({
        context: { workspace: { id: "workspace-token" } },
        input: {
          page: 2,
          perPage: 5,
          workspaceId: "workspace-forged",
        },
      }),
    ).resolves.toEqual({
      data: [{ id: "story-1" }],
      pageCount: 1,
    })

    expect(mocks.listStoryReplyAutomationsForWorkspace).toHaveBeenCalledWith({
      page: 2,
      perPage: 5,
      workspaceId: "workspace-token",
    })
  })

  test("returns not found when the requested record does not belong to the token workspace", async () => {
    const procedure = findWorkspaceTokenProcedure(
      "GET",
      "/v1/story-reply-automation/{id}",
    )
    mocks.findStoryReplyAutomationForWorkspace.mockResolvedValueOnce(undefined)

    await expect(
      procedure.handler?.({
        context: { workspace: { id: "workspace-token" } },
        input: { id: "story-1" },
      }),
    ).rejects.toThrow("Story Reply Automation not found")

    expect(mocks.findStoryReplyAutomationForWorkspace).toHaveBeenCalledWith(
      "workspace-token",
      "story-1",
    )
  })

  test("passes the token workspace to create/update/delete and fail-closes against a forged input workspaceId", async () => {
    const createProcedure = findWorkspaceTokenProcedure(
      "POST",
      "/v1/story-reply-automation",
    )
    const updateProcedure = findWorkspaceTokenProcedure(
      "PUT",
      "/v1/story-reply-automation/{id}",
    )
    const deleteProcedure = findWorkspaceTokenProcedure(
      "DELETE",
      "/v1/story-reply-automation/{id}",
    )

    mocks.createStoryReplyAutomation.mockResolvedValueOnce({ id: "story-1" })
    mocks.updateStoryReplyAutomation.mockResolvedValueOnce({ id: "story-1" })
    mocks.deleteStoryReplyAutomation.mockResolvedValueOnce(undefined)

    await expect(
      createProcedure.handler?.({
        context: { workspace: { id: "workspace-token" } },
        input: { name: "Story", workspaceId: "workspace-forged" },
      }),
    ).resolves.toEqual({ id: "story-1" })

    await expect(
      updateProcedure.handler?.({
        context: { workspace: { id: "workspace-token" } },
        input: {
          id: "story-1",
          name: "Updated",
          workspaceId: "workspace-forged",
        },
      }),
    ).resolves.toEqual({ id: "story-1" })

    await expect(
      deleteProcedure.handler?.({
        context: { workspace: { id: "workspace-token" } },
        input: { id: "story-1", workspaceId: "workspace-forged" },
      }),
    ).resolves.toBeUndefined()

    expect(mocks.createStoryReplyAutomation).toHaveBeenCalledWith(
      "workspace-token",
      { name: "Story" },
    )
    expect(mocks.updateStoryReplyAutomation).toHaveBeenCalledWith(
      { workspaceId: "workspace-token", id: "story-1" },
      { name: "Updated" },
    )
    expect(mocks.deleteStoryReplyAutomation).toHaveBeenCalledWith({
      workspaceId: "workspace-token",
      id: "story-1",
    })
  })
})
