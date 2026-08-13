import { beforeEach, describe, expect, test, vi } from "vitest"

const queueAdd = vi.fn()
const loggerWarn = vi.fn()

vi.mock("../src/lib/logger", () => ({
  logger: {
    warn: loggerWarn,
  },
}))

const { webhookHandler } = await import("../src/handlers/webhook")
const { hmacSha256Hex } = await import("../src/lib/webhook")

const config = {
  clientId: "app-1",
  clientSecret: "secret-1",
  verifyToken: "verify-1",
  version: "v1.0",
}

describe("threads webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test("responds to hub challenge", async () => {
    const req = new Request(
      "https://example.com/webhook?hub.mode=subscribe&hub.verify_token=verify-1&hub.challenge=abc",
      { method: "GET" },
    )

    await expect(
      webhookHandler({ config, req, queue: { add: queueAdd } as never }),
    ).resolves.toBe("abc")
  })

  test("verifies signature and enqueues incoming comment", async () => {
    const body = JSON.stringify({
      app_id: "app-1",
      topic: "moderate",
      target_id: "user-1",
      time: 1_723_420_800,
      subscription_id: "sub-1",
      values: {
        field: "replies",
        value: {
          id: "comment-1",
          username: "alice",
          text: "hello",
          root_post: {
            id: "post-1",
            owner_id: "owner-1",
            username: "brand",
          },
        },
      },
    })
    const signature = await hmacSha256Hex("secret-1", body)
    const req = new Request("https://example.com/webhook", {
      method: "POST",
      body,
      headers: {
        "x-hub-signature-256": `sha256=${signature}`,
      },
    })

    await expect(
      webhookHandler({
        config,
        req,
        queue: { add: queueAdd } as never,
      }),
    ).resolves.toBe("ok")

    expect(queueAdd).toHaveBeenCalledWith(
      "incomingComment",
      expect.objectContaining({
        data: expect.objectContaining({
          integrationType: "threads",
          integrationIdentifier: "owner-1",
        }),
      }),
    )
  })

  test("falls back to target_id only when has_uid_field is true", async () => {
    const body = JSON.stringify({
      app_id: "app-1",
      has_uid_field: true,
      topic: "moderate",
      target_id: "target-owner-1",
      time: 1_723_420_800,
      subscription_id: "sub-1",
      values: {
        field: "replies",
        value: {
          id: "comment-1",
          username: "alice",
          text: "hello",
          root_post: {
            id: "post-1",
          },
        },
      },
    })
    const signature = await hmacSha256Hex("secret-1", body)
    const req = new Request("https://example.com/webhook", {
      method: "POST",
      body,
      headers: {
        "x-hub-signature-256": `sha256=${signature}`,
      },
    })

    await expect(
      webhookHandler({
        config,
        req,
        queue: { add: queueAdd } as never,
      }),
    ).resolves.toBe("ok")

    expect(queueAdd).toHaveBeenCalledWith(
      "incomingComment",
      expect.objectContaining({
        data: expect.objectContaining({
          integrationType: "threads",
          integrationIdentifier: "target-owner-1",
        }),
      }),
    )
  })

  test("skips replies when no reliable integration identifier is available", async () => {
    const body = JSON.stringify({
      app_id: "app-1",
      topic: "moderate",
      target_id: "possibly-a-media-id",
      time: 1_723_420_800,
      subscription_id: "sub-1",
      values: {
        field: "replies",
        value: {
          id: "comment-1",
          username: "alice",
          root_post: {
            id: "post-1",
          },
        },
      },
    })
    const signature = await hmacSha256Hex("secret-1", body)
    const req = new Request("https://example.com/webhook", {
      method: "POST",
      body,
      headers: {
        "x-hub-signature-256": `sha256=${signature}`,
      },
    })

    await expect(
      webhookHandler({
        config,
        req,
        queue: { add: queueAdd } as never,
      }),
    ).resolves.toBe("ok")

    expect(queueAdd).not.toHaveBeenCalled()
    expect(loggerWarn).toHaveBeenCalledWith(
      { reason: "missing_integration_identifier" },
      "threads webhook payload unrecognized — skipping",
    )
  })

  test("rejects invalid signatures", async () => {
    const req = new Request("https://example.com/webhook", {
      method: "POST",
      body: "{}",
      headers: {
        "x-hub-signature-256": "sha256=deadbeef",
      },
    })

    await expect(
      webhookHandler({ config, req, queue: { add: queueAdd } as never }),
    ).rejects.toThrow("Invalid webhook signature")
  })

  test("rejects mismatched verification token and app_id", async () => {
    const verifyReq = new Request(
      "https://example.com/webhook?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=abc",
      { method: "GET" },
    )
    await expect(
      webhookHandler({
        config,
        req: verifyReq,
        queue: { add: queueAdd } as never,
      }),
    ).rejects.toThrow("Invalid webhook verification parameters")

    const body = JSON.stringify({
      app_id: "wrong-app",
      topic: "moderate",
      target_id: "user-1",
      time: 1_723_420_800,
      subscription_id: "sub-1",
      values: {
        field: "replies",
        value: {
          id: "comment-1",
          username: "alice",
          root_post: {
            id: "post-1",
            owner_id: "owner-1",
            username: "brand",
          },
        },
      },
    })
    const signature = await hmacSha256Hex("secret-1", body)
    const req = new Request("https://example.com/webhook", {
      method: "POST",
      body,
      headers: { "x-hub-signature-256": `sha256=${signature}` },
    })

    await expect(
      webhookHandler({ config, req, queue: { add: queueAdd } as never }),
    ).rejects.toThrow("Webhook app_id does not match configured clientId")
  })

  test("ignores non-replies and self-authored replies", async () => {
    const ignoredPayloads = [
      {
        app_id: "app-1",
        topic: "moderate",
        target_id: "user-1",
        time: 1_723_420_800,
        subscription_id: "sub-1",
        values: {
          field: "likes",
          value: {
            id: "comment-1",
            username: "alice",
            root_post: {
              id: "post-1",
              owner_id: "owner-1",
              username: "brand",
            },
          },
        },
      },
      {
        app_id: "app-1",
        topic: "moderate",
        target_id: "user-1",
        time: 1_723_420_800,
        subscription_id: "sub-1",
        values: {
          field: "replies",
          value: {
            id: "comment-2",
            is_reply_owned_by_me: true,
            username: "external-user",
            root_post: {
              id: "post-1",
              owner_id: "owner-1",
            },
          },
        },
      },
      {
        app_id: "app-1",
        topic: "moderate",
        target_id: "user-1",
        time: 1_723_420_800,
        subscription_id: "sub-1",
        values: {
          field: "replies",
          value: {
            id: "comment-3",
            username: "brand",
            root_post: {
              id: "post-1",
              owner_id: "owner-1",
              username: "brand",
            },
          },
        },
      },
    ]

    for (const payload of ignoredPayloads) {
      const body = JSON.stringify(payload)
      const signature = await hmacSha256Hex("secret-1", body)
      const req = new Request("https://example.com/webhook", {
        method: "POST",
        body,
        headers: { "x-hub-signature-256": `sha256=${signature}` },
      })

      await expect(
        webhookHandler({ config, req, queue: { add: queueAdd } as never }),
      ).resolves.toBe("ok")
    }

    expect(queueAdd).not.toHaveBeenCalled()
  })

  test("ignores invalid json and schema mismatches with sanitized warnings", async () => {
    const invalidJsonBody = "{bad json"
    const invalidJsonSignature = await hmacSha256Hex(
      "secret-1",
      invalidJsonBody,
    )

    await expect(
      webhookHandler({
        config,
        req: new Request("https://example.com/webhook", {
          method: "POST",
          body: invalidJsonBody,
          headers: {
            "x-hub-signature-256": `sha256=${invalidJsonSignature}`,
          },
        }),
        queue: { add: queueAdd } as never,
      }),
    ).resolves.toBe("ok")

    const schemaBody = JSON.stringify({
      app_id: "app-1",
      topic: "moderate",
      target_id: "user-1",
      time: 1_723_420_800,
      subscription_id: "sub-1",
      values: {
        field: "replies",
        value: {
          username: "alice",
          root_post: {
            id: "post-1",
            owner_id: "owner-1",
            username: "brand",
          },
        },
      },
    })
    const schemaSignature = await hmacSha256Hex("secret-1", schemaBody)

    await expect(
      webhookHandler({
        config,
        req: new Request("https://example.com/webhook", {
          method: "POST",
          body: schemaBody,
          headers: {
            "x-hub-signature-256": `sha256=${schemaSignature}`,
          },
        }),
        queue: { add: queueAdd } as never,
      }),
    ).resolves.toBe("ok")

    expect(loggerWarn).toHaveBeenCalledTimes(2)
  })

  test("rejects empty payloads, missing signatures, and unsupported methods", async () => {
    await expect(
      webhookHandler({
        config,
        req: new Request("https://example.com/webhook", {
          method: "POST",
          body: "",
          headers: { "x-hub-signature-256": "sha256=deadbeef" },
        }),
        queue: { add: queueAdd } as never,
      }),
    ).rejects.toThrow("Empty webhook payload")

    await expect(
      webhookHandler({
        config,
        req: new Request("https://example.com/webhook", {
          method: "POST",
          body: "{}",
        }),
        queue: { add: queueAdd } as never,
      }),
    ).rejects.toThrow("Missing webhook signature")

    await expect(
      webhookHandler({
        config,
        req: new Request("https://example.com/webhook", {
          method: "PUT",
        }),
        queue: { add: queueAdd } as never,
      }),
    ).rejects.toThrow("Unsupported HTTP method: PUT")
  })
})
