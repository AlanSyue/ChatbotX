import { beforeEach, describe, expect, test, vi } from "vitest"

const {
  mockFindContactInboxBy,
  mockFindActiveAutomations,
  mockIsWithinSchedule,
  mockIncrementRepliesCount,
  mockWorkspaceFindById,
  mockAiAgentFindBy,
  mockChatQueueAdd,
  mockIntegrationQueueAdd,
  mockGenerateAIReplyText,
  mockContactVariableGetAll,
  mockContactVariableReplaceAll,
  mockLoggerInfo,
  mockLoggerWarn,
  mockStoryReplyFindActiveAutomations,
  mockStoryReplyIsWithinSchedule,
  mockStoryReplyGetOrCreateDispatch,
  mockStoryReplyMarkDispatchScheduled,
  mockStoryReplyClaimReplySend,
  mockWithBlockedOwnerGuard,
  mockIdentifyInboxAndIntegrationAuthFromIdentifier,
  mockIsInstagramViaFacebook,
  mockSendMessengerStoryReply,
  mockSendInstagramStoryReply,
} = vi.hoisted(() => ({
  mockFindContactInboxBy: vi.fn(),
  mockFindActiveAutomations: vi.fn(),
  mockIsWithinSchedule: vi.fn(),
  mockIncrementRepliesCount: vi.fn(),
  mockWorkspaceFindById: vi.fn(),
  mockAiAgentFindBy: vi.fn(),
  mockChatQueueAdd: vi.fn(),
  mockIntegrationQueueAdd: vi.fn(),
  mockGenerateAIReplyText: vi.fn(),
  mockContactVariableGetAll: vi.fn(),
  mockContactVariableReplaceAll: vi.fn(),
  mockLoggerInfo: vi.fn(),
  mockLoggerWarn: vi.fn(),
  mockStoryReplyFindActiveAutomations: vi.fn(),
  mockStoryReplyIsWithinSchedule: vi.fn(),
  mockStoryReplyGetOrCreateDispatch: vi.fn(),
  mockStoryReplyMarkDispatchScheduled: vi.fn(),
  mockStoryReplyClaimReplySend: vi.fn(),
  mockWithBlockedOwnerGuard: vi.fn(),
  mockIdentifyInboxAndIntegrationAuthFromIdentifier: vi.fn(),
  mockIsInstagramViaFacebook: vi.fn(),
  mockSendMessengerStoryReply: vi.fn(),
  mockSendInstagramStoryReply: vi.fn(),
}))

vi.mock("@chatbotx.io/business", () => ({
  contactInboxService: { findBy: mockFindContactInboxBy },
  aiAgentService: { findBy: mockAiAgentFindBy },
  fbCommentAutomationService: { isWithinSchedule: mockIsWithinSchedule },
  igStoryAutomationService: {
    findActiveAutomations: mockFindActiveAutomations,
    incrementRepliesCount: mockIncrementRepliesCount,
  },
  storyReplyAutomationService: {
    findActiveAutomations: mockStoryReplyFindActiveAutomations,
    isWithinSchedule: mockStoryReplyIsWithinSchedule,
    getOrCreateDispatch: mockStoryReplyGetOrCreateDispatch,
    markDispatchScheduled: mockStoryReplyMarkDispatchScheduled,
    claimReplySend: mockStoryReplyClaimReplySend,
  },
  workspaceService: { findById: mockWorkspaceFindById },
  withBlockedOwnerGuard: mockWithBlockedOwnerGuard,
}))

vi.mock("@chatbotx.io/variables", () => ({
  contactVariableService: {
    getAll: mockContactVariableGetAll,
    replaceAll: mockContactVariableReplaceAll,
  },
}))

vi.mock("@chatbotx.io/worker-config", () => ({
  ChatJobAction: { sendChatMessage: "sendChatMessage" },
  chatQueue: { add: mockChatQueueAdd },
  IntegrationJobAction: {
    sendFlow: "sendFlow",
    dispatchStoryReplyAutomation: "dispatchStoryReplyAutomation",
  },
  integrationQueue: { add: mockIntegrationQueueAdd },
}))

vi.mock("@chatbotx.io/events/context", () => ({
  webhookChannelOrigin: vi.fn().mockReturnValue("webhook"),
}))

vi.mock("@chatbotx.io/integration-messenger", () => ({
  sendStoryReply: mockSendMessengerStoryReply,
}))

vi.mock("@chatbotx.io/integration-instagram", () => ({
  sendStoryReply: mockSendInstagramStoryReply,
}))

vi.mock("../src/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: mockLoggerWarn,
    info: mockLoggerInfo,
    debug: vi.fn(),
  },
}))

vi.mock("../src/integration/handlers/automated-response/replies", () => ({
  generateAIReplyText: mockGenerateAIReplyText,
}))

vi.mock("../src/services/integrations", () => ({
  integrationService: {
    identifyInboxAndIntegrationAuthFromIdentifier:
      mockIdentifyInboxAndIntegrationAuthFromIdentifier,
  },
  isInstagramViaFacebook: mockIsInstagramViaFacebook,
}))

const { dispatchStoryReplyAutomation, processStoryReplyAutomation } =
  await import("../src/integration/handlers/story-reply-automation")

const STORY_ID = "2357494887629356"
const MESSAGE_ID = "message-1"

function buildUpstreamAutomation(reply: {
  type: string
  value: string | null
}) {
  return {
    id: "automation-1",
    story: { type: "all", value: [] },
    includeKeywords: { type: "all", value: [] },
    reply,
  }
}

function buildUpstreamJobData(overrides: { message?: string } = {}) {
  return {
    workspaceId: "workspace-1",
    conversationId: "conversation-1",
    contactInboxId: "contact-inbox-1",
    messageId: MESSAGE_ID,
    storyId: STORY_ID,
    message: overrides.message ?? "hello",
    channelType: "instagram",
  } as const
}

function buildLegacyAutomation() {
  return {
    id: "legacy-automation-1",
    startTime: null,
    endTime: null,
    storyTarget: { type: "all", value: [] },
    includeKeywords: { type: "all", value: [] },
    excludeKeywords: [],
    reply: { type: "text", value: "Thanks from legacy" },
    replyAfter: { type: "immediately" },
  }
}

function buildLegacyJobData() {
  return {
    integrationType: "messenger",
    integrationIdentifier: "integration-1",
    workspaceId: "workspace-1",
    conversationId: "conversation-1",
    contactInboxId: "contact-inbox-1",
    psid: "psid-1",
    storyId: STORY_ID,
    mid: "mid-1",
    message: "hello from story",
  } as const
}

beforeEach(() => {
  vi.clearAllMocks()

  mockFindContactInboxBy.mockResolvedValue({
    id: "contact-inbox-1",
    contactId: "contact-1",
  })
  mockWorkspaceFindById.mockResolvedValue({ timezone: "UTC" })
  mockIsWithinSchedule.mockReturnValue(true)
  mockIncrementRepliesCount.mockResolvedValue(undefined)
  mockChatQueueAdd.mockResolvedValue(undefined)
  mockIntegrationQueueAdd.mockResolvedValue(undefined)
  mockContactVariableGetAll.mockResolvedValue({})
  mockContactVariableReplaceAll.mockImplementation(({ text }) => text)

  mockStoryReplyFindActiveAutomations.mockResolvedValue([
    buildLegacyAutomation(),
  ])
  mockStoryReplyIsWithinSchedule.mockReturnValue(true)
  mockStoryReplyGetOrCreateDispatch.mockResolvedValue({
    id: "dispatch-1",
    scheduledAt: null,
  })
  mockStoryReplyMarkDispatchScheduled.mockResolvedValue(true)
  mockStoryReplyClaimReplySend.mockResolvedValue("claimed")
  mockWithBlockedOwnerGuard.mockImplementation(async (_workspaceId, fn) => {
    await fn()
  })
  mockIdentifyInboxAndIntegrationAuthFromIdentifier.mockResolvedValue({
    integrationRow: { auth: { accessToken: "token" } },
  })
  mockIsInstagramViaFacebook.mockReturnValue(false)
  mockSendMessengerStoryReply.mockResolvedValue(undefined)
  mockSendInstagramStoryReply.mockResolvedValue(undefined)
})

describe("processStoryReplyAutomation upstream replies", () => {
  test("resolves {{variable}} tokens through contactVariableService before sending the story reply", async () => {
    mockFindActiveAutomations.mockResolvedValue([
      buildUpstreamAutomation({
        type: "text",
        value: "Hi {{contact.firstName}}",
      }),
    ])
    mockContactVariableReplaceAll.mockResolvedValue("Hi Jane")

    await processStoryReplyAutomation(buildUpstreamJobData())

    expect(mockContactVariableGetAll).toHaveBeenCalledWith({
      contactId: "contact-1",
      contactInbox: { id: "contact-inbox-1", contactId: "contact-1" },
    })
    expect(mockContactVariableReplaceAll).toHaveBeenCalledWith({
      text: "Hi {{contact.firstName}}",
      variables: {},
    })
    expect(mockChatQueueAdd).toHaveBeenCalledWith("sendChatMessage", {
      type: "sendChatMessage",
      data: {
        conversation: { id: "conversation-1", workspaceId: "workspace-1" },
        contactInbox: { id: "contact-inbox-1", contactId: "contact-1" },
        text: "Hi Jane",
      },
    })
    expect(mockIncrementRepliesCount).toHaveBeenCalledWith("automation-1")
  })

  test("sends the raw text unchanged when it contains no variable tokens", async () => {
    mockFindActiveAutomations.mockResolvedValue([
      buildUpstreamAutomation({ type: "text", value: "Thanks for the reply!" }),
    ])

    await processStoryReplyAutomation(buildUpstreamJobData())

    expect(mockChatQueueAdd).toHaveBeenCalledWith(
      "sendChatMessage",
      expect.objectContaining({
        data: expect.objectContaining({ text: "Thanks for the reply!" }),
      }),
    )
  })

  test("falls back to the raw text when variable resolution fails", async () => {
    mockFindActiveAutomations.mockResolvedValue([
      buildUpstreamAutomation({
        type: "text",
        value: "Hi {{contact.firstName}}",
      }),
    ])
    mockContactVariableReplaceAll.mockRejectedValue(new Error("db down"))

    await processStoryReplyAutomation(buildUpstreamJobData())

    expect(mockChatQueueAdd).toHaveBeenCalledWith(
      "sendChatMessage",
      expect.objectContaining({
        data: expect.objectContaining({ text: "Hi {{contact.firstName}}" }),
      }),
    )
    expect(mockIncrementRepliesCount).toHaveBeenCalledWith("automation-1")
  })
})

describe("processStoryReplyAutomation legacy coexist path", () => {
  test("routes legacy payloads into the legacy dispatch action and marks the ledger row scheduled", async () => {
    await processStoryReplyAutomation(buildLegacyJobData())

    expect(
      mockIdentifyInboxAndIntegrationAuthFromIdentifier,
    ).toHaveBeenCalledWith("messenger", "integration-1")
    expect(mockStoryReplyFindActiveAutomations).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      channelType: "messenger",
    })
    expect(mockStoryReplyGetOrCreateDispatch).toHaveBeenCalledWith({
      automationId: "legacy-automation-1",
      storyReplyMessageId: "mid-1",
      workspaceId: "workspace-1",
    })
    expect(mockIntegrationQueueAdd).toHaveBeenCalledWith(
      "dispatchStoryReplyAutomation",
      {
        type: "dispatchStoryReplyAutomation",
        data: {
          integrationType: "messenger",
          integrationIdentifier: "integration-1",
          automationId: "legacy-automation-1",
          mid: "mid-1",
          psid: "psid-1",
          text: "Thanks from legacy",
          workspaceId: "workspace-1",
        },
      },
      expect.objectContaining({
        delay: 0,
        jobId: "story-reply-legacy-automation-1-mid-1",
      }),
    )
    expect(mockStoryReplyMarkDispatchScheduled).toHaveBeenCalledWith({
      automationId: "legacy-automation-1",
      storyReplyMessageId: "mid-1",
      workspaceId: "workspace-1",
      hasReply: true,
    })
  })

  test("does not enqueue a duplicate legacy dispatch when the ledger row is already scheduled", async () => {
    mockStoryReplyGetOrCreateDispatch.mockResolvedValue({
      id: "dispatch-1",
      scheduledAt: new Date("2026-08-13T00:00:00Z"),
    })

    await processStoryReplyAutomation(buildLegacyJobData())

    expect(mockIntegrationQueueAdd).not.toHaveBeenCalled()
    expect(mockStoryReplyMarkDispatchScheduled).not.toHaveBeenCalled()
    expect(mockLoggerInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        automationId: "legacy-automation-1",
        mid: "mid-1",
        reason: "story reply dispatch already scheduled",
        storyId: STORY_ID,
        workspaceId: "workspace-1",
      }),
      "Legacy story reply automation skipped",
    )
  })
})

describe("dispatchStoryReplyAutomation", () => {
  test("skips the outbound send when the private reply was already claimed", async () => {
    mockStoryReplyClaimReplySend.mockResolvedValue("already-sent")

    await dispatchStoryReplyAutomation({
      integrationType: "messenger",
      integrationIdentifier: "integration-1",
      automationId: "legacy-automation-1",
      mid: "mid-1",
      psid: "psid-1",
      text: "Thanks from legacy",
      workspaceId: "workspace-1",
    })

    expect(mockSendMessengerStoryReply).not.toHaveBeenCalled()
    expect(mockLoggerInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        automationId: "legacy-automation-1",
        mid: "mid-1",
        reason: "private reply already sent",
        workspaceId: "workspace-1",
      }),
      "Legacy story reply automation skipped",
    )
  })

  test("sends the private reply through messenger when the claim succeeds", async () => {
    await dispatchStoryReplyAutomation({
      integrationType: "messenger",
      integrationIdentifier: "integration-1",
      automationId: "legacy-automation-1",
      mid: "mid-1",
      psid: "psid-1",
      text: "Thanks from legacy",
      workspaceId: "workspace-1",
    })

    expect(mockStoryReplyClaimReplySend).toHaveBeenCalledWith({
      automationId: "legacy-automation-1",
      storyReplyMessageId: "mid-1",
      workspaceId: "workspace-1",
    })
    expect(mockSendMessengerStoryReply).toHaveBeenCalledWith(
      { accessToken: "token" },
      "psid-1",
      "Thanks from legacy",
    )
  })
})
