export const selectAutomatedResponseText = (
  response: {
    text?: string | null
    texts?: string[] | null
  },
  random = Math.random,
): string | null => {
  const texts = response.texts?.filter((text) => text.length > 0) ?? []
  if (texts.length === 0) {
    return response.text ?? null
  }

  const index = Math.min(Math.floor(random() * texts.length), texts.length - 1)
  return texts[index] as string
}
