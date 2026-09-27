import type { Calibration } from '../domain/types'

export type PixelWall = { x1: number; y1: number; x2: number; y2: number; thicknessPixels: number }

// An unannotated raster contains no absolute unit. Start with a residential-sized
// footprint, then refine it using the wall widths found by the image analyzer.
export function initialAutoScale(width: number, height: number): Calibration {
  const basisPixels = Math.max(width, height)
  const metresPerPixel = 12 / basisPixels
  return { a: { x: 0, z: 0 }, b: { x: basisPixels, z: 0 }, knownMetres: 12,
    metresPerPixel, method: 'auto', basisPixels }
}

export function estimateAutoScale(walls: PixelWall[], width: number, height: number): Calibration {
  if (!walls.length) return initialAutoScale(width, height)
  const xs = walls.flatMap(w => [w.x1, w.x2]), ys = walls.flatMap(w => [w.y1, w.y2])
  const basisPixels = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), 1)
  const thicknesses = walls.map(w => w.thicknessPixels).filter(n => n >= 2 && n < basisPixels * .08).sort((a, b) => a - b)
  const representative = thicknesses[Math.floor(thicknesses.length * .7)]
  const bySpan = 12 / basisPixels
  const byWall = representative ? .18 / representative : bySpan
  const metresPerPixel = Math.max(.002, Math.min(.25, Math.sqrt(bySpan * byWall)))
  return { a: { x: 0, z: 0 }, b: { x: basisPixels, z: 0 }, knownMetres: basisPixels * metresPerPixel,
    metresPerPixel, method: 'auto', basisPixels }
}

export function setEstimatedSpan(calibration: Calibration, metres: number): Calibration {
  const basisPixels = calibration.basisPixels || Math.hypot(calibration.b.x - calibration.a.x, calibration.b.z - calibration.a.z)
  if (!Number.isFinite(metres) || metres <= 0 || !basisPixels) throw new Error('Enter a valid building size.')
  return { ...calibration, knownMetres: metres, metresPerPixel: metres / basisPixels, method: 'manual', basisPixels }
}
