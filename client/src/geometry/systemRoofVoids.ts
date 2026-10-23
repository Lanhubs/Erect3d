import type { Building, RoofSection } from '../domain/types'
import { systemOpenings } from './systemOpenings'
import { containsPolygon } from './polygons'
// A vertical opening that reaches a roof cuts its actual surface, not just slabs.
export function systemRoofVoids(building: Building, sections: RoofSection[]): RoofSection[] {
  const voids = systemOpenings(building)
  if (!voids.length) return sections
  return sections.map((section) => {
    const level = building.levels.find((l) => l.id === section.levelId)
    if (!level) return section
    const roofY = level.elevation + (section.topHeight || Math.max(2.7, ...level.walls.map((w) => w.height)))
    const holes = voids
      .filter((s) => {
        const bottom = s.base
        return (
          bottom <= roofY + 0.001 &&
          bottom + s.height >= roofY - 0.001 &&
          containsPolygon(section.footprint, s.polygon)
        )
      })
      .map((s) => s.polygon)
    if (!holes.length) return section
    const seen = new Set<string>(),
      merged = [...(section.voids || []), ...holes].filter((ring) => {
        const key = JSON.stringify(ring)
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
    return { ...section, voids: merged }
  })
}
