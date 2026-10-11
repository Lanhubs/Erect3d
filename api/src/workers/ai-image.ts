import sharp from 'sharp'
import { ProviderFailure } from '../modules/ai/provider'
export async function prepareAiImage(bytes: Uint8Array) {
  const image = sharp(bytes, { limitInputPixels: 100_000_000 }).flatten({ background: '#ffffff' })
    .resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true })
  const png = await image.clone().png().toBuffer()
  if (png.length <= 10 * 1024 * 1024) return { bytes: new Uint8Array(png), mime: 'image/png' }
  const jpeg = await image.clone().jpeg({ quality: 90 }).toBuffer()
  if (jpeg.length > 10 * 1024 * 1024) throw new ProviderFailure('AI_IMAGE_LIMIT', false)
  return { bytes: new Uint8Array(jpeg), mime: 'image/jpeg' }
}
