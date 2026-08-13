export type AutomatedResponseTextWrite = {
  text: string | null
  texts: string[]
}

export const getAutomatedResponseTextWrite = (input: {
  flowId?: string | null
  text?: string | null
  texts?: string[]
}): AutomatedResponseTextWrite | undefined => {
  if (input.flowId) {
    return { text: null, texts: [] }
  }
  if (input.texts !== undefined) {
    return {
      text: input.texts[0] ?? null,
      texts: input.texts,
    }
  }
  if (input.text !== undefined) {
    return {
      text: input.text,
      texts: input.text ? [input.text] : [],
    }
  }
  return
}
