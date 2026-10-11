import sharp from 'sharp'
import { readConfig } from '../src/config/env'
import { GeminiProvider } from '../src/modules/ai/gemini'

const config = readConfig()
if (process.env.LIVE_GEMINI_CONFIRM !== 'yes' || !config.GEMINI_API_KEY) {
  throw new Error('Opt-in only: configure GEMINI_API_KEY and LIVE_GEMINI_CONFIRM=yes; this check consumes provider quota')
}
const bytes = await sharp({ create: { width: 300, height: 300, channels: 3, background: 'white' } }).png().toBuffer()
const provider = new GeminiProvider(config.GEMINI_API_KEY)
const result = await provider.interpret({ pass: 'structure', model: config.GEMINI_MODEL_PLAN,
  bytes, mime: 'image/png', width: 300, height: 300, candidates: [] }, AbortSignal.timeout(config.AI_TIMEOUT_MS))
console.log(JSON.stringify({ status: 'structured-output-valid', candidates: result.proposal.candidates.length, usage: result.usage }))
