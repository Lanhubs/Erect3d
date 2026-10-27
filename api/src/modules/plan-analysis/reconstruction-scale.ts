import type { AnalysisInput, Intelligence } from '../../contracts/analysis'
import { inferredScale } from './inferred-scale'
import { anchorRoomScale } from './room-scale'
export function reconstructionScale(
  input: AnalysisInput,
  proposal: Intelligence,
  width: number,
  height: number,
) {
  const result = structuredClone(input),
    evidence = anchorRoomScale(proposal, width, height).understanding?.scale
  if (input.options.purpose !== 'rebuild' || input.calibration.method === 'manual') return result
  if (!evidence) {
    result.calibration = inferredScale(proposal, width, height) || result.calibration
    return result
  }
  const pixels = Math.hypot((evidence.b.x - evidence.a.x) * width, (evidence.b.y - evidence.a.y) * height)
  const metresPerPixel = evidence.knownMetres / pixels
  if (pixels < 2 || !Number.isFinite(metresPerPixel) || metresPerPixel < 0.00001 || metresPerPixel > 10)
    return result
  result.calibration = {
    a: { x: 0, z: 0 },
    b: { x: pixels, z: 0 },
    knownMetres: evidence.knownMetres,
    metresPerPixel,
    method: 'auto',
    basisPixels: pixels,
  }
  return result
}
