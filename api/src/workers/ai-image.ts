import sharp from 'sharp'
import { ProviderFailure } from '../modules/ai/provider'
import { sniff } from '../modules/assets/validation'
export async function prepareAiImage(
  bytes: Uint8Array,
  region?: { x: number; y: number; width: number; height: number },
) {
  // The full source reaches the provider byte for byte. Never resize or JPEG-encode it.
  if (!region) {
    const mime = sniff(bytes)
    if (!['image/png', 'image/jpeg'].includes(mime || '')) throw new ProviderFailure('AI_IMAGE_FORMAT', false)
    if (bytes.length > 10 * 1024 * 1024) throw new ProviderFailure('AI_IMAGE_LIMIT', false)
    return { bytes, mime: mime! }
  }
  const image = sharp(bytes, { limitInputPixels: 100_000_000 })
  if (region) {
    const metadata = await image.metadata(),
      width = metadata.width!,
      height = metadata.height!
    image.keepIccProfile()
    if (metadata.depth === 'ushort') image.pipelineColourspace('rgb16').toColourspace('rgb16')
    const left = Math.min(width - 1, Math.floor(region.x * width)),
      top = Math.min(height - 1, Math.floor(region.y * height))
    image.extract({
      left,
      top,
      width: Math.max(1, Math.min(width - left, Math.ceil(region.width * width - 1e-8))),
      height: Math.max(1, Math.min(height - top, Math.ceil(region.height * height - 1e-8))),
    })
  }
  const png = await image.clone().png().toBuffer()
  if (png.length <= 10 * 1024 * 1024) return { bytes: new Uint8Array(png), mime: 'image/png' }
  throw new ProviderFailure('AI_IMAGE_LIMIT', false)
}
