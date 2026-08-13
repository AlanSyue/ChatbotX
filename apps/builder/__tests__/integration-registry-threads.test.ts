// @vitest-environment node

import { describe, expect, test, vi } from "vitest"

const integrationThreads = { name: "threads-integration" }

vi.mock("@chatbotx.io/integration-active-campaign", () => ({
  integration: {},
}))
vi.mock("@chatbotx.io/integration-chatbotx", () => ({ integration: {} }))
vi.mock("@chatbotx.io/integration-drip", () => ({ integration: {} }))
vi.mock("@chatbotx.io/integration-facebook-ads", () => ({ integration: {} }))
vi.mock("@chatbotx.io/integration-get-response", () => ({ integration: {} }))
vi.mock("@chatbotx.io/integration-google-sheets", () => ({ integration: {} }))
vi.mock("@chatbotx.io/integration-instagram", () => ({ integration: {} }))
vi.mock("@chatbotx.io/integration-instagram-facebook", () => ({
  integration: {},
}))
vi.mock("@chatbotx.io/integration-klaviyo", () => ({ integration: {} }))
vi.mock("@chatbotx.io/integration-mailchimp", () => ({ integration: {} }))
vi.mock("@chatbotx.io/integration-mailer-lite", () => ({ integration: {} }))
vi.mock("@chatbotx.io/integration-messenger", () => ({ integration: {} }))
vi.mock("@chatbotx.io/integration-moosend", () => ({ integration: {} }))
vi.mock("@chatbotx.io/integration-sendgrid", () => ({ integration: {} }))
vi.mock("@chatbotx.io/integration-smtp", () => ({ integration: {} }))
vi.mock("@chatbotx.io/integration-telegram", () => ({ integration: {} }))
vi.mock("@chatbotx.io/integration-threads", () => ({
  integration: integrationThreads,
}))
vi.mock("@chatbotx.io/integration-tiktok", () => ({ integration: {} }))
vi.mock("@chatbotx.io/integration-webchat", () => ({ integration: {} }))
vi.mock("@chatbotx.io/integration-whatsapp", () => ({ integration: {} }))
vi.mock("@chatbotx.io/integration-zalo", () => ({ integration: {} }))

const { integrations } = await import("../src/integration")

describe("builder integration registry", () => {
  test("registers threads integration", () => {
    expect(integrations.threads).toBe(integrationThreads)
  })
})
