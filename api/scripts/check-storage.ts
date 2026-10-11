import { readConfig } from '../src/config/env'
import { PrivateS3 } from '../src/storage/objects'

const config = readConfig()
if (!config.S3_BUCKET) throw new Error('Configure private S3 settings before running this opt-in check')
const storage = new PrivateS3(config), key = `private/integration/${crypto.randomUUID()}.png`
const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])
try {
  await storage.probe()
  const uploaded = await fetch(storage.uploadUrl(key, 'image/png'), {
    method: 'PUT', headers: { 'Content-Type': 'image/png' }, body: bytes,
  })
  if (!uploaded.ok) throw new Error(`Signed PUT rejected: ${uploaded.status}`)
  if ((await storage.stat(key)).size !== bytes.length) throw new Error('Stored size did not match')
  const url = storage.downloadUrl(key), downloaded = await fetch(url)
  if (!downloaded.ok || !Buffer.from(await downloaded.arrayBuffer()).equals(Buffer.from(bytes))) throw new Error('Signed GET did not round-trip')
  const anonymous = new URL(url)
  anonymous.search = ''
  if ((await fetch(anonymous)).ok) throw new Error('Object is publicly readable: fix bucket policy before deployment')
  console.log('Private S3 probe, signed PUT/GET and anonymous-read rejection passed')
} finally { await storage.delete(key) }
