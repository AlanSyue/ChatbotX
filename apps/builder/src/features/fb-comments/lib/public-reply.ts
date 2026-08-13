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

export function normalizePublicReply(
  reply: FBCommentPublicReply,
): FBCommentPublicReply {
  if (reply.type !== "text") {
    const { values: _values, ...rest } = reply
    return rest
  }

  const values = getPublicReplyValues(reply)
  return {
    ...reply,
    value: values[0] ?? null,
    ...(values.length > 0 ? { values } : {}),
  }
}

export function getInitialPublicReplyValues(
  reply: FBCommentPublicReply,
): string[] | undefined {
  if (reply.type !== "text") {
    return
  }

  const values = getPublicReplyValues(reply)
  if (values.length > 0) {
    return values
  }

  return [reply.value ?? ""]
}

export function getEditablePublicReplyState(props: {
  isFirstRun: boolean
  previousType: FBCommentPublicReply["type"] | undefined
  reply: FBCommentPublicReply
}): Pick<FBCommentPublicReply, "value" | "values"> {
  const { isFirstRun, previousType, reply } = props

  if (reply.type !== "text") {
    return {
      value:
        !isFirstRun && previousType && previousType !== reply.type
          ? null
          : reply.value,
      values: undefined,
    }
  }

  if (reply.values && reply.values.length > 0) {
    return {
      value: reply.values[0] ?? null,
      values: reply.values,
    }
  }

  if (!isFirstRun && previousType && previousType !== "text") {
    return {
      value: "",
      values: [""],
    }
  }

  const values = getInitialPublicReplyValues(reply)
  return {
    value: values?.[0] ?? null,
    values,
  }
}
