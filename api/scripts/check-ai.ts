import sharp from 'sharp'
import { readConfig } from '../src/config/env'
import { GeminiProvider } from '../src/modules/ai/gemini'

const config = readConfig()
// The check spends paid provider quota, so an operator has to state that in the environment
// even when a key is already configured; no automated suite can set it.
if (process.env.LIVE_GEMINI_CONFIRM !== 'yes')
  throw new Error('Opt-in only: set LIVE_GEMINI_CONFIRM=yes to accept spending real Gemini quota')
if (!config.GEMINI_API_KEY) throw new Error('Configure GEMINI_API_KEY before running the live AI check')
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
