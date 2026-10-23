import type { Config } from '../../config/env'
import { zipSource } from '../../storage/archive'
export type Optimization = {
  bytes: Uint8Array
  method: string
  inputBytes: number
  storedBytes: number
  savedBytes: number
}
// Validate/process original bytes first. Storage alone receives a reversible ZIP envelope.
export async function optimizeAsset(
  bytes: Uint8Array,
  _mime: string,
  _config: Pick<Config, 'PDF_OPTIMIZER_PATH' | 'ASSET_OPTIMIZE_TIMEOUT_MS'>,
): Promise<Optimization> {
  const zipped = zipSource(bytes),
    smaller = zipped.length < bytes.length,
    output = smaller ? zipped : bytes
  return {
    bytes: output,
    method: smaller ? 'lossless-zip' : 'original-bytes',
    inputBytes: bytes.length,
    storedBytes: output.length,
    savedBytes: bytes.length - output.length,
  }
}
