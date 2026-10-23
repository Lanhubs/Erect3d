import sharp from 'sharp'
import type { Config } from '../src/config/env'
import { PrivateR2 } from '../src/storage/objects'
import { optimizeAsset } from '../src/modules/assets/optimize'
import type { ObjectStore } from '../src/storage/objects'

export async function checkPrivateR2(
  config: Config,
  origin?: string,
  dependencies: { store?: ObjectStore; request?: typeof fetch } = {},
) {
  if (!config.R2_BUCKET) throw new Error('Configure private Cloudflare R2 before this opt-in check')
  if (origin && new URL(origin).origin !== origin)
    throw new Error('LIVE_STORAGE_ORIGIN must be an exact origin')
  const storage = dependencies.store || new PrivateR2(config),
    request = dependencies.request || fetch
  const original = await sharp(
    Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><rect width="300" height="300" fill="white"/><path d="M30 260V30H260V260H160 M120 260H30" fill="none" stroke="black" stroke-width="6"/></svg>',
    ),
  )
    .png({ compressionLevel: 0 })
    .toBuffer()
  const optimized = await optimizeAsset(original, 'image/png', config),
    bytes = optimized.bytes
  const key = `private/integration/${crypto.randomUUID()}${optimized.method === 'lossless-zip' ? '.zip' : '.png'}`,
    mime = optimized.method === 'lossless-zip' ? 'application/zip' : 'image/png'
  const signal = () => AbortSignal.timeout(30000)
  let written = false
  try {
    written = true // A lost response may still have written the test object.
    const uploaded = await request(storage.uploadUrl(key, mime), {
      method: 'PUT',
      headers: { 'Content-Type': mime },
      body: new Uint8Array(bytes),
      signal: signal(),
    })
    if (!uploaded.ok) {
      if ([400, 401, 403, 404].includes(uploaded.status)) written = false
      const code = (await uploaded.text()).match(/<Code>([A-Za-z][A-Za-z0-9]{2,80})<\/Code>/)?.[1]
      throw new Error(`Signed PUT rejected: ${uploaded.status}${code ? ` (${code})` : ''}`)
    }
    if ((await storage.stat(key)).size !== bytes.length) throw new Error('Stored size did not match')
    const url = storage instanceof PrivateR2 ? storage.storedDownloadUrl(key) : storage.downloadUrl(key),
      downloaded = await request(url, { signal: signal(), headers: origin ? { Origin: origin } : undefined })
    if (!downloaded.ok || !Buffer.from(await downloaded.arrayBuffer()).equals(Buffer.from(bytes)))
      throw new Error('Signed GET did not round-trip')
    if (origin && downloaded.headers.get('Access-Control-Allow-Origin') !== origin)
      throw new Error('R2 CORS does not allow the exact requested frontend origin')
    const anonymous = new URL(url)
    anonymous.search = ''
    const denied = await request(anonymous, { signal: signal() })
    if (![401, 403].includes(denied.status))
      throw new Error(`Unsigned account-endpoint request was not denied: ${denied.status}`)
    return {
      inputBytes: optimized.inputBytes,
      storedBytes: bytes.length,
      method: optimized.method,
      corsChecked: Boolean(origin),
    }
  } finally {
    if (written) await storage.delete(key)
  }
}
