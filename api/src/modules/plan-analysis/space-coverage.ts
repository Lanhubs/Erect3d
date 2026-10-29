import type { Level } from '../../contracts/project'
import type { ModelQuality } from './quality'
import { enclosedSpaces, signedPlanArea } from '../../../../client/src/geometry/roomTopology'
import { containsPoint } from '../../../../client/src/geometry/polygons'

// Audit actual closed wall faces, never the image rectangle or a convex building hull.
// Unassigned courts/shafts stay review evidence, not invented indoor rooms.
export function spaceCoverage(
  level: Level,
  dimensions?: { width: number; height: number },
): ModelQuality['issues'] {
  const issues: ModelQuality['issues'] = []
  const exclusions = level.slabs?.flatMap((slab) => slab.openings.map((opening) => opening.polygon)) || []
  for (const [index, polygon] of enclosedSpaces(level.walls).slice(0, 512).entries()) {
    const area = Math.abs(signedPlanArea(polygon))
    if (area < 2) continue
    const minX = Math.min(...polygon.map((p) => p.x)),
      maxX = Math.max(...polygon.map((p) => p.x))
    const minZ = Math.min(...polygon.map((p) => p.z)),
      maxZ = Math.max(...polygon.map((p) => p.z))
    const step = Math.max(0.25, Math.sqrt(((maxX - minX) * (maxZ - minZ)) / 2048))
    let total = 0,
      missing = 0
    for (let x = minX + step / 2; x < maxX; x += step)
      for (let z = minZ + step / 2; z < maxZ; z += step) {
        const p = { x, z }
        if (!containsPoint(polygon, p) || exclusions.some((ring) => containsPoint(ring, p))) continue
        total++
        if (!level.rooms.some((room) => containsPoint(room.polygon, p))) missing++
      }
    if (!total || missing / total < 0.2 || missing * step * step < 2) continue
    let sourceRegion: ModelQuality['issues'][number]['sourceRegion']
    if (dimensions && level.calibration) {
      const c = level.calibration,
        offset = level.alignment || { x: 0, z: 0 }
      const x = Math.max(0, ((minX - offset.x) / c.metresPerPixel + c.a.x) / dimensions.width)
      const y = Math.max(0, ((minZ - offset.z) / c.metresPerPixel + c.a.z) / dimensions.height)
      const right = Math.min(1, ((maxX - offset.x) / c.metresPerPixel + c.a.x) / dimensions.width)
      const bottom = Math.min(1, ((maxZ - offset.z) / c.metresPerPixel + c.a.z) / dimensions.height)
      if (right > x && bottom > y) sourceRegion = { x, y, width: right - x, height: bottom - y }
    }
    issues.push({
      code: 'UNASSIGNED_ENCLOSURE',
      severity: 'warning',
      candidateId: `space_audit_${index}`,
      sourceRegion,
      message: `An enclosed area near (${minX.toFixed(2)}, ${minZ.toFixed(2)}) m has about ${(missing * step * step).toFixed(1)} m² unaccounted for. Read this region's original labels, wall faces and access. Represent every supported space, or explicitly identify a courtyard/void; do not fill it with a guessed room.`,
    })
  }
  return issues
}
