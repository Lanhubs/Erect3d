import type { Intelligence } from '../../contracts/analysis'
import { estimateAutoScale } from '../../../../client/src/geometry/autoScale'
// No pixels are resampled. Only source-supported geometry supplies the fallback;
// the surrounding sheet/margins never define a building's physical width.
export function inferredScale(proposal: Intelligence, width: number, height: number) {
  const walls = proposal.candidates
    .filter((c) => c.kind === 'wall' && c.points.length >= 2)
    .map((c) => ({
      x1: c.points[0].x * width,
      y1: c.points[0].y * height,
      x2: c.points.at(-1)!.x * width,
      y2: c.points.at(-1)!.y * height,
      thicknessPixels: (c.thickness || 0) * width,
    }))
  if (!walls.length) return undefined
  const doors = proposal.candidates
    .filter((c) => c.kind === 'door' && c.doorStyle !== 'double' && c.points.length === 2)
    .map((c) => ({
      x1: c.points[0].x * width,
      y1: c.points[0].y * height,
      x2: c.points[1].x * width,
      y2: c.points[1].y * height,
      kind: 'swing',
    }))
  return estimateAutoScale(walls, width, height, doors)
}
