export type ImageSize = { width: number; height: number }

const maxPixels = 256_000_000

export async function pngSize(file: Blob): Promise<ImageSize> {
  const header = new Uint8Array(await file.slice(0, 24).arrayBuffer())
  const ihdr = String.fromCharCode(...header.slice(12, 16))
  if (header.length < 24 || ihdr !== 'IHDR') throw new Error('This PNG has an invalid image header.')
  const view = new DataView(header.buffer)
  return { width: view.getUint32(16), height: view.getUint32(20) }
}

export function validateImageSize({ width, height }: ImageSize): void {
  if (width < 1 || height < 1) throw new Error('The plan has invalid image dimensions.')
  if (width * height > maxPixels) throw new Error(`This plan is ${width} × ${height} pixels (${Math.round(width * height / 1_000_000)} MP). The browser workspace supports up to 256 MP.`)
}
