const BEARER_TOKEN_RE = /^Bearer\s+(.+)$/i

export function extractWorkspaceBearerToken(headers: Headers): string | null {
  const authorization = headers.get("Authorization")
  const token = authorization?.match(BEARER_TOKEN_RE)?.[1]?.trim()
  return token || null
}
