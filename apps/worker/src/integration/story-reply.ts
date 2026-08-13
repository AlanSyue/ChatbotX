type LegacyStoryReplyMessage = {
  id: string
  sourceId?: string | null
}

export function resolveLegacyStoryReplyMid(
  message: LegacyStoryReplyMessage,
): string {
  return message.sourceId ?? message.id
}

export function buildLegacyStoryReplyJobId(mid: string): string {
  return `story-reply-auto-legacy-${encodeURIComponent(mid)}`
}
