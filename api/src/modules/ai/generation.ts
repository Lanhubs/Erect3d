import { ThinkingLevel } from '@google/genai'
export function planGeneration(model: string, pass: string) {
  const argon = /^gemini-4(?:-|$)/.test(model)
  return {
    ...(argon ? {} : { temperature: 0 }),
    ...(/^gemini-[34]/.test(model) && (/^reconstruct-/.test(pass) || pass === 'validated-model-repair')
      ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
      : {}),
    maxOutputTokens: argon ? 32768 : pass === 'validated-model-repair' ? 16000 : 24000,
  }
}
