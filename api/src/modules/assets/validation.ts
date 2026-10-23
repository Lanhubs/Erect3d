import sharp from 'sharp'
import { ApiError } from '../../security/errors'
import { digest } from '../../security/tokens'
export function sniff(bytes: Uint8Array) {
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value)) return 'image/png'
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg'
  if (new TextDecoder().decode(bytes.slice(0, 5)) === '%PDF-') return 'application/pdf'
  if (bytes[0] === 123 || bytes[0] === 91) return 'application/json'
  return null
}
export async function validateAsset(bytes: Uint8Array, mime: string, kind: string) {
  if (sniff(bytes) !== mime)
    throw new ApiError(422, 'MIME_MISMATCH', 'File contents do not match its declared format')
  if (mime === 'application/pdf' && kind !== 'source')
    throw new ApiError(422, 'INVALID_CATEGORY', 'PDF must be a source document')
  if (mime === 'application/json')
    throw new ApiError(422, 'INVALID_CATEGORY', 'JSON exports are created by the server')
  if (mime.startsWith('image/')) {
    try {
      const image = sharp(bytes, { limitInputPixels: 100_000_000, animated: false })
      const metadata = await image.metadata()
      if (!metadata.width || !metadata.height || (metadata.pages || 1) > 1)
        throw new Error('Invalid dimensions')
      // Decode to check truncation/corruption, bounded by the pixel limit.
      await image.resize({ width: 64, height: 64, fit: 'inside' }).toBuffer()
      return { width: metadata.width, height: metadata.height, orientation: metadata.orientation || 1 }
    } catch {
      throw new ApiError(422, 'INVALID_IMAGE', 'Image is corrupt or exceeds the processing limit')
    }
  }
  return { format: 'pdf-original', signatureValidated: true }
}
export const bytesHash = (bytes: Uint8Array) => new Bun.CryptoHasher('sha256').update(bytes).digest('hex')
