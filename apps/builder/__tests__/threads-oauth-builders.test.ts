import { describe, expect, test, vi } from "vitest"
import {
  buildThreadsReferer,
  buildThreadsWebhookUrl,
} from "../src/features/integration-threads/libs/oauth"

vi.mock("@/lib/oauth-broker", () => ({
  buildBrokerCallbackUrl: (path: string) => `https://broker.example.com${path}`,
}))

describe("threads oauth builders", () => {
  test("builds the settings referer from the workspace origin", () => {
    expect(buildThreadsReferer("42", "https://app.example.com")).toBe(
      "https://app.example.com/space/42/settings/channels?channel=threads",
    )
  })

  test("builds the broker webhook url with an encoded client id", () => {
    expect(buildThreadsWebhookUrl("threads app/id")).toBe(
      "https://broker.example.com/integrations/threads/webhook?appId=threads%20app%2Fid",
    )
  })
})
