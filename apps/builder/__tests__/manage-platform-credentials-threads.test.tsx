// @vitest-environment node

import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, test, vi } from "vitest"

const findPlatform = vi.fn()
const resolvePublicForUser = vi.fn()
const threadsSettingsSpy = vi.fn((_props: unknown) => null)

vi.mock("@chatbotx.io/business", () => ({
  platformCredentialService: {
    findPlatform,
    resolvePublicForUser,
  },
}))

vi.mock("@/env", () => ({
  isCloud: () => false,
}))

vi.mock("@/features/platform-credentials/threads/threads-settings", () => ({
  ThreadsSettings: (props: unknown) => threadsSettingsSpy(props),
}))

vi.mock("@/features/platform-credentials/messenger/messenger-settings", () => ({
  MessengerSettings: () => null,
}))
vi.mock("@/features/platform-credentials/instagram/instagram-settings", () => ({
  InstagramSettings: () => null,
}))
vi.mock(
  "@/features/platform-credentials/instagram-facebook/instagram-facebook-settings",
  () => ({
    InstagramFacebookSettings: () => null,
  }),
)
vi.mock("@/features/platform-credentials/google/google-settings", () => ({
  GoogleSettings: () => null,
}))
vi.mock("@/features/platform-credentials/whatsapp/whatsapp-settings", () => ({
  WhatsappSettings: () => null,
}))
vi.mock("@/features/platform-credentials/zalo/zalo-settings", () => ({
  ZaloSettings: () => null,
}))
vi.mock("@/features/platform-credentials/tiktok/tiktok-settings", () => ({
  TiktokSettings: () => null,
}))
vi.mock("@/features/platform-credentials/giphy/giphy-settings", () => ({
  GiphySettings: () => null,
}))
vi.mock("@/features/platform-credentials/make/make-settings", () => ({
  MakeSettings: () => null,
}))

const { ManagePlatformCredentials } = await import(
  "../src/features/platform-credentials/manage-platform-credentials"
)

describe("ManagePlatformCredentials — Threads", () => {
  test("passes only publicConfig to ThreadsSettings", async () => {
    findPlatform.mockImplementation(async ({ type }: { type: string }) =>
      type === "threads"
        ? {
            publicConfig: {
              clientId: "threads-client-id",
              version: "v1.0",
              verifyToken: "verify-token",
            },
          }
        : undefined,
    )
    resolvePublicForUser.mockResolvedValue(undefined)

    renderToStaticMarkup(await ManagePlatformCredentials({}))

    expect(threadsSettingsSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        isInherited: false,
        publicConfig: {
          clientId: "threads-client-id",
          version: "v1.0",
          verifyToken: "verify-token",
        },
      }),
    )
    expect(threadsSettingsSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({
        publicConfig: expect.objectContaining({
          clientSecret: expect.anything(),
        }),
      }),
    )
  })
})
