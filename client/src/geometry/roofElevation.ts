import type { Level, RoofSection } from '../domain/types'
import { roofLayout } from './roof'
export function roofElevation(sections: RoofSection[], levels: Level[]) {
  let top = 0
  for (const section of sections) {
    const level = levels.find((l) => l.id === section.levelId)
    if (!level || section.footprint.length < 3) continue
    const xs = section.footprint.map((p) => p.x),
      zs = section.footprint.map((p) => p.z)
    const bounds = {
      minX: Math.min(...xs),
      maxX: Math.max(...xs),
      minZ: Math.min(...zs),
      maxZ: Math.max(...zs),
      top: section.topHeight || Math.max(2.7, ...level.walls.map((w) => w.height)),
    }
    for (const face of roofLayout(bounds, section.roof).faces)
      for (const vertex of face) top = Math.max(top, level.elevation + vertex[1])
    if (section.roof.shape === 'hidden' || section.roof.shape === 'terrace')
      top = Math.max(top, level.elevation + bounds.top + 0.675)
  }
  return top
}
