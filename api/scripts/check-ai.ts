import sharp from 'sharp'
import { readConfig } from '../src/config/env'
import { GeminiProvider } from '../src/modules/ai/gemini'

const config = readConfig()
if (!config.GEMINI_API_KEY) {
  throw new Error(
    'Opt-in only: configure GEMINI_API_KEY and LIVE_GEMINI_CONFIRM=yes; this check consumes provider quota',
  )
}
const drawing = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><rect width="300" height="300" fill="white"/><path d="M40 240V40H260V240H170 M130 240H40" fill="none" stroke="black" stroke-width="7"/><path d="M130 240V200 M130 200Q170 200 170 240" fill="none" stroke="black" stroke-width="1"/></svg>`
const bytes = await sharp(Buffer.from(drawing)).png().toBuffer()
const provider = new GeminiProvider(config.GEMINI_API_KEY)
const pass = process.env.LIVE_AI_PASS === 'global-understanding' ? 'global-understanding' : 'structure'
const result = await provider.interpret(
  {
    pass,
    model: config.GEMINI_MODEL_PLAN,
    bytes,
    mime: 'image/png',
    width: 300,
    height: 300,
    candidates: [],
  },
  AbortSignal.timeout(config.AI_TIMEOUT_MS),
)
console.log(
  JSON.stringify({
    status: 'structured-output-valid',
    syntheticFixture: true,
    candidates: result.proposal.candidates.length,
    walls: result.proposal.candidates.filter((candidate) => candidate.kind === 'wall').length,
    usage: result.usage,
  }),
)
