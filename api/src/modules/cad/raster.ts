import sharp from 'sharp'
import { CadFailure } from './types'

export const maximumRasterSide = 3000

/** sharp renders the SVG with librsvg at its declared pixel size; text needs a real font. */
export async function svgToPng(svg: string, width: number, height: number): Promise<Uint8Array> {
  try {
    const bytes = await sharp(Buffer.from(svg), { limitInputPixels: 40_000_000, animated: false })
      .resize({ width, height, fit: 'fill' })
      .png({ compressionLevel: 8 })
      .toBuffer()
    if (!bytes.length) throw new Error('empty raster')
    return new Uint8Array(bytes)
  } catch (error) {
    throw new CadFailure('RASTER_FAILED', `Rasterising the drawing failed: ${(error as Error).message}`)
  }
}
