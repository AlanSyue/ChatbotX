// @vitest-environment jsdom
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { MessageActions } from "@/features/messages/components/message-actions"
import { MessageItem } from "@/features/messages/components/message-item"
import type { MessageResourceWithRelations } from "@/features/messages/schema/resource"

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock("next/image", () => ({
  default: ({
    alt,
    src,
    ...props
  }: React.ImgHTMLAttributes<HTMLImageElement>) => (
    // biome-ignore lint/performance/noImgElement: test double for next/image
    <img alt={alt} height={1} src={src} width={1} {...props} />
  ),
}))

vi.mock("@chatbotx.io/business/utils", () => ({
  buildMessageLink: (channel: string, sourceId: string) =>
    `https://example.com/${channel}/${sourceId}`,
}))

vi.mock("lucide-react", () => ({
  BotIcon: () => <span data-icon="bot" />,
  EllipsisVerticalIcon: () => <span data-icon="ellipsis" />,
  ExternalLinkIcon: () => <span data-icon="external-link" />,
  EyeOff: () => <span data-icon="eye-off" />,
  ImageIcon: () => <span data-icon="image" />,
  PaperclipIcon: () => <span data-icon="paperclip" />,
  PencilIcon: () => <span data-icon="pencil" />,
  ReplyIcon: () => <span data-icon="reply" />,
  ThumbsUp: () => <span data-icon="thumbs-up" />,
  TrashIcon: () => <span data-icon="trash" />,
  XIcon: () => <span data-icon="x" />,
}))

vi.mock("@/hooks/routing", () => ({
  useWorkspaceId: () => "ws-1",
}))

vi.mock("@/features/attachments/utils", () => ({
  useAttachmentUrl: () => null,
}))

vi.mock("@chatbotx.io/ui/components/ui/button", () => ({
  Button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: string
    size?: string
  }) => <button {...props}>{children}</button>,
  buttonVariants: () => "",
}))

vi.mock("@chatbotx.io/ui/components/ui/popover", () => ({
  Popover: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  PopoverTrigger: ({ render }: { render: React.ReactElement }) => render,
  PopoverContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}))

vi.mock("@chatbotx.io/ui/components/ui/alert-dialog", () => ({
  AlertDialog: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogTrigger: ({ render }: { render: React.ReactElement }) => render,
  AlertDialogContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogTitle: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogDescription: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogFooter: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogCancel: ({ children }: { children: React.ReactNode }) => (
    <button type="button">{children}</button>
  ),
  AlertDialogAction: ({
    children,
    onClick,
  }: {
    children: React.ReactNode
    onClick?: () => void
  }) => (
    <button onClick={onClick} type="button">
      {children}
    </button>
  ),
}))

vi.mock("@chatbotx.io/ui/components/ui/textarea", () => ({
  Textarea: (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
    <textarea {...props} />
  ),
}))

vi.mock("@chatbotx.io/ui/components/uploader/direct-upload-button", () => ({
  DirectUploadButton: ({ children }: { children?: React.ReactNode }) => (
    <button type="button">{children}</button>
  ),
}))

type StoreConversation = {
  id: string
  contactInboxes: Array<{ channel: string }>
}

let storeState: {
  activeConversationId: string | null
  conversations: StoreConversation[]
} = {
  activeConversationId: "conv-1",
  conversations: [
    {
      id: "conv-1",
      contactInboxes: [{ channel: "messenger" }],
    },
  ],
}

vi.mock("@/features/chat/store/chat-store-provider", () => ({
  useChatStore: (selector: (state: typeof storeState) => unknown) =>
    selector(storeState),
}))

let container: HTMLDivElement | null = null
let root: Root | null = null
const noop = () => null

function renderComponent(ui: React.ReactElement) {
  container = document.createElement("div")
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => {
    root?.render(ui)
  })
  return container
}

function makeMessage(
  overrides: Partial<MessageResourceWithRelations> = {},
): MessageResourceWithRelations {
  return {
    id: "msg-1",
    workspaceId: "ws-1",
    conversationId: "conv-1",
    contactInboxId: "contact-inbox-1",
    createdAt: new Date("2024-01-01T00:00:00Z"),
    updatedAt: new Date("2024-01-01T00:00:00Z"),
    messageType: "incoming",
    type: "comment",
    text: "Comment text",
    sourceId: "comment-1",
    deletedAt: null,
    attributes: null,
    contentAttributes: null,
    attachments: [],
    ...overrides,
  } as MessageResourceWithRelations
}

beforeEach(() => {
  storeState = {
    activeConversationId: "conv-1",
    conversations: [
      {
        id: "conv-1",
        contactInboxes: [{ channel: "messenger" }],
      },
    ],
  }
})

afterEach(() => {
  if (root) {
    act(() => {
      root?.unmount()
    })
  }
  container?.remove()
  container = null
  root = null
})

describe("Threads comment UI capabilities", () => {
  test("keeps reply-only controls for incoming Threads comments", () => {
    storeState = {
      activeConversationId: "conv-1",
      conversations: [
        {
          id: "conv-1",
          contactInboxes: [{ channel: "threads" }],
        },
      ],
    }

    const element = renderComponent(
      <MessageItem
        message={makeMessage()}
        onChangeHide={noop}
        onChangeLike={noop}
        onDelete={noop}
        onEdit={noop}
        onReply={noop}
      />,
    )

    expect(element.querySelector('[data-icon="reply"]')).not.toBeNull()
    expect(element.querySelector('[data-icon="thumbs-up"]')).toBeNull()
    expect(element.querySelector('[data-icon="ellipsis"]')).toBeNull()
  })

  test("preserves Messenger comment controls", () => {
    const element = renderComponent(
      <MessageItem
        message={makeMessage()}
        onChangeHide={noop}
        onChangeLike={noop}
        onDelete={noop}
        onEdit={noop}
        onReply={noop}
      />,
    )

    expect(element.querySelector('[data-icon="reply"]')).not.toBeNull()
    expect(element.querySelector('[data-icon="thumbs-up"]')).not.toBeNull()
    expect(element.querySelector('[data-icon="ellipsis"]')).not.toBeNull()
  })

  test("returns no action menu for Threads comments even when handlers are passed", () => {
    storeState = {
      activeConversationId: "conv-1",
      conversations: [
        {
          id: "conv-1",
          contactInboxes: [{ channel: "threads" }],
        },
      ],
    }

    const element = renderComponent(
      <MessageActions
        message={makeMessage({ messageType: "outgoing" })}
        onChangeHide={noop}
        onDelete={noop}
        onEdit={noop}
      />,
    )

    expect(element.innerHTML).toBe("")
  })
})
