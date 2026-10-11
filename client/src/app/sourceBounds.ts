import type { Calibration, Point, SourceDocument } from '../domain/types'

export function sourceBounds(source: SourceDocument | undefined, url: string | undefined, calibration: Calibration | undefined, alignment: Point | undefined) {
  if (!source || !url || !calibration) return undefined
  return { url, x: -calibration.a.x * calibration.metresPerPixel + (alignment?.x || 0),
    z: -calibration.a.z * calibration.metresPerPixel + (alignment?.z || 0),
    width: source.width * calibration.metresPerPixel, height: source.height * calibration.metresPerPixel }
}
