import { defaultRoof, type Building, type Level } from '../domain/types'
import { effectiveRoofSections } from '../domain/roofCoverage'
import { roofLayout } from '../geometry/roof'
import { clipRoofLayout } from '../geometry/roofFootprint'
import { roofOverhang } from '../geometry/roofOverhang'
import { roofClosurePanels } from '../geometry/roofClosure'
import type { SoftwareFace } from './softwareDetails'

export function softwareRoofs(level: Level, building?: Building): SoftwareFace[] {
  const model = building || {
    id: 'preview',
    name: 'Preview',
    levels: [level],
    roof: level.roof || defaultRoof,
  }
  return effectiveRoofSections(model)
    .filter((section) => section.levelId === level.id)
    .flatMap((section) => {
      const xs = section.footprint.map((p) => p.x),
        zs = section.footprint.map((p) => p.z)
      const bounds = {
        minX: Math.min(...xs),
        maxX: Math.max(...xs),
        minZ: Math.min(...zs),
        maxZ: Math.max(...zs),
        top: section.topHeight || Math.max(2.7, ...level.walls.map((wall) => wall.height)),
      }
      const full = roofLayout(bounds, section.roof),
        clipped = section.followFootprint
          ? clipRoofLayout(full, roofOverhang(section.footprint, section.roof.overhang), section.voids)
          : full
      const closures = section.followFootprint
        ? roofClosurePanels([section.footprint, ...(section.voids || [])], clipped.faces, bounds.top)
        : full.gables
      const surface: SoftwareFace[] = clipped.faces.map((vertices, index) => ({
        key: `${section.id}:face:${index}`,
        vertices,
        fill: section.roof.color,
        stroke: 'none',
        depth: 1000 + vertices.reduce((sum, [x, , z]) => sum + x + z, 0) / vertices.length,
      }))
      return [
        ...surface,
        ...closures.map((vertices, index) => ({
          key: `${section.id}:gable:${index}`,
          vertices,
          fill: '#d2d0c7',
          stroke: '#8d8f88',
          depth: 999,
        })),
      ]
    })
}
