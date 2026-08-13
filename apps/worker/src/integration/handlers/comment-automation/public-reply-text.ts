import { createHash } from "node:crypto"
import type { FBCommentPublicReply } from "@chatbotx.io/database/partials"

export function getPublicReplyValues(reply: FBCommentPublicReply): string[] {
  if (reply.type !== "text") {
    return []
  }

  const values = reply.values?.filter((value) => value.trim().length > 0) ?? []
  if (values.length > 0) {
    return values.slice(0, 10)
  }

  return reply.value ? [reply.value] : []
}

export function selectPublicReplyText(props: {
  automationId: string
  commentId: string
  reply: FBCommentPublicReply
}): string {
  const values = getPublicReplyValues(props.reply)
  if (values.length <= 1) {
    return values[0] ?? props.reply.value ?? ""
  }

  const seed = `${props.automationId}:${props.commentId}`
  const digest = createHash("sha256").update(seed).digest()
  const bucket = digest.readUInt32BE(0) % values.length
  return values[bucket] ?? values[0] ?? ""
}
