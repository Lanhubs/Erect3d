import { readConfig } from '../src/config/env'
import { checkPrivateR2 } from './storage-smoke'

const config = readConfig()
try {
  const result=await checkPrivateR2(config,process.env.LIVE_STORAGE_ORIGIN)
  console.log(JSON.stringify({ signedTransfers:'passed',unsignedAccountEndpoint:'denied',...result }))
  console.log('Also verify r2.dev and public custom-domain access are disabled in the Cloudflare dashboard.')
} catch (error) {
  // Avoid printing SDK errors that can contain signed URLs or credentials.
  const message=error instanceof Error?error.message:''
  const safe=/^(Configure private|LIVE_STORAGE_ORIGIN|Signed PUT rejected:|Stored size|Signed GET|R2 CORS|Unsigned account-endpoint)/.test(message)
  console.error(safe?message:'R2 storage check failed; verify endpoint, credentials and bucket permissions.')
  process.exitCode=1
}
