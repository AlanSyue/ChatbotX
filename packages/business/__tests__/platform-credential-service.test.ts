import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

const tenantService = { findByOwner: vi.fn() }
vi.mock("../src/enterprise/tenant/service", () => ({ tenantService }))

vi.mock("@chatbotx.io/database/client", () => ({
  db: {},
  and: vi.fn(),
  eq: vi.fn(),
  isNull: vi.fn(),
  sql: vi.fn(),
}))
vi.mock("@chatbotx.io/database/partials", () => ({
  credentialEncryptedSchema: {},
  credentialPublicSchemas: {},
  credentialSchemas: {},
}))
vi.mock("@chatbotx.io/database/schema", () => ({ platformCredentialModel: {} }))
vi.mock("@chatbotx.io/encryption", () => ({ encryptUtils: {} }))
vi.mock("@chatbotx.io/redis", () => ({
  invalidateCacheByTags: vi.fn(async () => undefined),
  withCache: vi.fn(async (_key: string, fn: () => unknown) => fn()),
}))
const logger = { error: vi.fn(), warn: vi.fn() }
vi.mock("../src/logger", () => ({ logger }))

const { platformCredentialService } = await import(
  "../src/platform-credential/service"
)

const OWN = { id: "own", type: "messenger", publicConfig: { clientId: "own" } }
const PLATFORM = {
  id: "plat",
  type: "messenger",
  publicConfig: { clientId: "plat" },
}

const buildThreadsRow = (overrides: Record<string, unknown> = {}) => ({
  id: "threads-1",
  userId: null,
  type: "threads",
  publicConfig: { clientId: "client-1" },
  createdAt: new Date("2026-08-13T00:00:00.000Z"),
  updatedAt: new Date("2026-08-13T00:00:00.000Z"),
  ...overrides,
})

const buildThreadsTx = (rows: unknown[], error?: Error) =>
  ({
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: () => {
            if (error) {
              throw error
            }
            return rows
          },
        }),
      }),
    }),
  }) as never

beforeEach(() => {
  tenantService.findByOwner.mockReset()
  logger.error.mockReset()
  logger.warn.mockReset()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("resolveForOwner", () => {
  test("active tenant with own credential returns the reseller's own", async () => {
    tenantService.findByOwner.mockResolvedValue({ status: "active" })
    const own = vi
      .spyOn(platformCredentialService, "resolveForUser")
      .mockResolvedValue(OWN as never)
    const platform = vi.spyOn(
      platformCredentialService,
      "findDecryptedPlatform",
    )

    const result = await platformCredentialService.resolveForOwner({
      ownerId: "owner-1",
      type: "messenger",
    })

    expect(result).toBe(OWN)
    expect(own).toHaveBeenCalledWith({
      userId: "owner-1",
      type: "messenger",
      livemode: undefined,
      tx: undefined,
    })
    expect(platform).not.toHaveBeenCalled()
  })

  test("active tenant WITHOUT own credential falls back to platform", async () => {
    tenantService.findByOwner.mockResolvedValue({ status: "active" })
    vi.spyOn(platformCredentialService, "resolveForUser").mockResolvedValue(
      PLATFORM as never,
    )
    const platform = vi.spyOn(
      platformCredentialService,
      "findDecryptedPlatform",
    )

    const result = await platformCredentialService.resolveForOwner({
      ownerId: "owner-1",
      type: "messenger",
    })

    expect(result).toBe(PLATFORM)
    expect(platform).not.toHaveBeenCalled()
  })

  test("active tenant with usePlatformCredential resolves to platform", async () => {
    tenantService.findByOwner.mockResolvedValue({ status: "active" })
    vi.spyOn(platformCredentialService, "findForUser").mockResolvedValue({
      ...OWN,
      usePlatformCredential: true,
    } as never)
    const platform = vi
      .spyOn(platformCredentialService, "findDecryptedPlatform")
      .mockResolvedValue(PLATFORM as never)

    const result = await platformCredentialService.resolveForOwner({
      ownerId: "owner-1",
      type: "messenger",
    })

    expect(result).toBe(PLATFORM)
    expect(platform).toHaveBeenCalledTimes(1)
  })

  test("inactive tenant uses platform without reading own credential", async () => {
    tenantService.findByOwner.mockResolvedValue({ status: "suspended" })
    const own = vi.spyOn(platformCredentialService, "resolveForUser")
    const platform = vi
      .spyOn(platformCredentialService, "findDecryptedPlatform")
      .mockResolvedValue(PLATFORM as never)

    const result = await platformCredentialService.resolveForOwner({
      ownerId: "owner-1",
      type: "messenger",
    })

    expect(result).toBe(PLATFORM)
    expect(own).not.toHaveBeenCalled()
    expect(platform).toHaveBeenCalledTimes(1)
  })
})

describe("resolvePublicForUser", () => {
  test("own credential set returns it as not inherited", async () => {
    vi.spyOn(platformCredentialService, "findForUser").mockResolvedValue(
      OWN as never,
    )
    const platform = vi.spyOn(platformCredentialService, "findPlatform")

    const result = await platformCredentialService.resolvePublicForUser({
      userId: "user-1",
      type: "messenger",
    })

    expect(result).toEqual({
      publicConfig: OWN.publicConfig,
      isInherited: false,
    })
    expect(platform).not.toHaveBeenCalled()
  })

  test("no own credential falls back to platform as inherited", async () => {
    vi.spyOn(platformCredentialService, "findForUser").mockResolvedValue(
      undefined,
    )
    vi.spyOn(platformCredentialService, "findPlatform").mockResolvedValue(
      PLATFORM as never,
    )

    const result = await platformCredentialService.resolvePublicForUser({
      userId: "user-1",
      type: "messenger",
    })

    expect(result).toEqual({
      publicConfig: PLATFORM.publicConfig,
      isInherited: true,
    })
  })

  test("own credential flagged usePlatformCredential falls back to platform", async () => {
    vi.spyOn(platformCredentialService, "findForUser").mockResolvedValue({
      ...OWN,
      usePlatformCredential: true,
    } as never)
    vi.spyOn(platformCredentialService, "findPlatform").mockResolvedValue(
      PLATFORM as never,
    )

    const result = await platformCredentialService.resolvePublicForUser({
      userId: "user-1",
      type: "messenger",
    })

    expect(result?.isInherited).toBe(true)
  })

  test("neither own nor platform returns undefined", async () => {
    vi.spyOn(platformCredentialService, "findForUser").mockResolvedValue(
      undefined,
    )
    vi.spyOn(platformCredentialService, "findPlatform").mockResolvedValue(
      undefined,
    )

    const result = await platformCredentialService.resolvePublicForUser({
      userId: "user-1",
      type: "messenger",
    })

    expect(result).toBeUndefined()
  })
})

describe("resolvePlatformAppAccessToken", () => {
  test("returns clientId and clientSecret joined as a Meta app token", async () => {
    vi.spyOn(
      platformCredentialService,
      "findDecryptedPlatform",
    ).mockResolvedValue({
      config: { clientId: "client-1", clientSecret: "secret-1" },
    } as never)

    await expect(
      platformCredentialService.resolvePlatformAppAccessToken("messenger"),
    ).resolves.toBe("client-1|secret-1")
  })

  test("returns undefined when the platform credential is missing", async () => {
    vi.spyOn(
      platformCredentialService,
      "findDecryptedPlatform",
    ).mockResolvedValue(undefined)

    await expect(
      platformCredentialService.resolvePlatformAppAccessToken("instagram"),
    ).resolves.toBeUndefined()
  })
})

describe("findThreadsCredentialByClientId", () => {
  test("returns the single platform credential when present", async () => {
    const decrypt = vi
      .spyOn(platformCredentialService as never, "_decrypt")
      .mockResolvedValue({ id: "platform-threads" } as never)

    const result =
      await platformCredentialService.findThreadsCredentialByClientId({
        clientId: "client-1",
        tx: buildThreadsTx([buildThreadsRow({ id: "platform-threads" })]),
      })

    expect(result).toEqual({ id: "platform-threads" })
    expect(decrypt).toHaveBeenCalledTimes(1)
  })

  test("prefers the platform credential when platform and user rows share a clientId", async () => {
    const decrypt = vi
      .spyOn(platformCredentialService as never, "_decrypt")
      .mockResolvedValue({ id: "platform-threads" } as never)

    const result =
      await platformCredentialService.findThreadsCredentialByClientId({
        clientId: "client-1",
        tx: buildThreadsTx([
          buildThreadsRow({ id: "platform-threads", userId: null }),
          buildThreadsRow({ id: "user-threads", userId: "user-1" }),
        ]),
      })

    expect(result).toEqual({ id: "platform-threads" })
    expect(decrypt).toHaveBeenCalledWith(
      expect.objectContaining({ id: "platform-threads", userId: null }),
    )
    expect(logger.warn).not.toHaveBeenCalled()
  })

  test("returns undefined and warns when the preferred scope has multiple matches", async () => {
    const decrypt = vi.spyOn(platformCredentialService as never, "_decrypt")

    const result =
      await platformCredentialService.findThreadsCredentialByClientId({
        clientId: "client-1",
        tx: buildThreadsTx([
          buildThreadsRow({ id: "platform-1", userId: null }),
          buildThreadsRow({ id: "platform-2", userId: null }),
        ]),
      })

    expect(result).toBeUndefined()
    expect(decrypt).not.toHaveBeenCalled()
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: "client-1",
        count: 2,
        livemode: false,
      }),
      "Threads credential lookup by clientId is ambiguous",
    )
  })

  test("returns the single user credential when no platform credential exists", async () => {
    const decrypt = vi
      .spyOn(platformCredentialService as never, "_decrypt")
      .mockResolvedValue({ id: "user-threads" } as never)

    const result =
      await platformCredentialService.findThreadsCredentialByClientId({
        clientId: "client-1",
        tx: buildThreadsTx([
          buildThreadsRow({ id: "user-threads", userId: "user-1" }),
        ]),
      })

    expect(result).toEqual({ id: "user-threads" })
    expect(decrypt).toHaveBeenCalledWith(
      expect.objectContaining({ id: "user-threads", userId: "user-1" }),
    )
  })

  test("returns undefined and logs safe metadata when lookup throws", async () => {
    const decrypt = vi.spyOn(platformCredentialService as never, "_decrypt")

    const result =
      await platformCredentialService.findThreadsCredentialByClientId({
        clientId: "secret-client-id",
        tx: buildThreadsTx([], new Error("top-secret-token")),
      })

    expect(result).toBeUndefined()
    expect(decrypt).not.toHaveBeenCalled()
    expect(logger.error).toHaveBeenCalledWith(
      {
        livemode: false,
        clientId: "secret-client-id",
        errorName: "Error",
      },
      "Failed to decrypt Threads credential by clientId",
    )
    expect(JSON.stringify(logger.error.mock.calls)).not.toContain(
      "top-secret-token",
    )
  })
})
