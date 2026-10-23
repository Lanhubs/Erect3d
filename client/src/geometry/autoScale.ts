import type { Calibration } from '../domain/types'

export type PixelWall = { x1: number; y1: number; x2: number; y2: number; thicknessPixels: number }

// An unannotated raster contains no absolute unit. Start with a residential-sized
// footprint, then refine it using the wall widths found by the image analyzer.
export function initialAutoScale(width: number, height: number): Calibration {
  const basisPixels = Math.max(width, height)
  const metresPerPixel = 12 / basisPixels
  return {
    a: { x: 0, z: 0 },
    b: { x: basisPixels, z: 0 },
    knownMetres: 12,
    metresPerPixel,
    method: 'auto',
    basisPixels,
  }
}

export function estimateAutoScale(
  walls: PixelWall[],
  width: number,
  height: number,
  features: Array<{ x1: number; y1: number; x2: number; y2: number; kind: string }> = [],
): Calibration {
  if (!walls.length) return initialAutoScale(width, height)
  const xs = walls.flatMap((w) => [w.x1, w.x2]),
    ys = walls.flatMap((w) => [w.y1, w.y2])
  const basisPixels = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), 1)
  const thicknesses = walls
    .map((w) => w.thicknessPixels)
    .filter((n) => n >= 2 && n < basisPixels * 0.08)
    .sort((a, b) => a - b)
  const representative = thicknesses[Math.floor(thicknesses.length * 0.7)]
  const bySpan = 12 / basisPixels
  const byWall = representative ? 0.18 / representative : bySpan
  const radii = features
    .filter((feature) => feature.kind === 'swing')
    .map((feature) => Math.hypot(feature.x2 - feature.x1, feature.y2 - feature.y1))
    .filter((radius) => radius >= 6 && radius < basisPixels * 0.12)
    .sort((a, b) => a - b)
  const medianRadius = radii[Math.floor(radii.length / 2)]
  const supportedDoors = radii.filter((radius) => radius > medianRadius * 0.75 && radius < medianRadius * 1.3)
  const byDoor = supportedDoors.length >= 3 ? 0.9 / medianRadius : 0
  const metresPerPixel = Math.max(0.002, Math.min(0.25, byDoor || Math.sqrt(bySpan * byWall)))
  return {
    a: { x: 0, z: 0 },
    b: { x: basisPixels, z: 0 },
    knownMetres: basisPixels * metresPerPixel,
    metresPerPixel,
    method: 'auto',
    basisPixels,
    basis: byDoor ? 'door-symbols' : 'wall-thickness',
  }
}

export function setEstimatedSpan(calibration: Calibration, metres: number): Calibration {
  const basisPixels =
    calibration.basisPixels ||
    Math.hypot(calibration.b.x - calibration.a.x, calibration.b.z - calibration.a.z)
  if (!Number.isFinite(metres) || metres <= 0 || !basisPixels) throw new Error('Enter a valid building size.')
  return {
    ...calibration,
    knownMetres: metres,
    metresPerPixel: metres / basisPixels,
    method: 'manual',
    basisPixels,
  }
}
