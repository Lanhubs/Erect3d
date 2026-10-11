import type { Building, Level } from '../domain/types'
import { createRoofGeometryCache } from '../domain/roofGeometryCache'
import { RoofAssembly } from './RoofAssembly'
import { useMemo } from 'react'

export function BuildingRoofs({ building, shown, offset }: { building: Building; shown: Level[]; offset: (level: Level) => number }) {
  const cachedSections = useMemo(() => createRoofGeometryCache(), [])
  const sections = useMemo(() => cachedSections(building), [building, cachedSections])
  return <>{sections.map(section => {
    const level = shown.find(item => item.id === section.levelId)
    if (!level || section.footprint.length < 3) return null
    const xs = section.footprint.map(point => point.x), zs = section.footprint.map(point => point.z)
    const bounds = { minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs),
      top: section.topHeight || Math.max(2.7, ...level.walls.map(wall => wall.height)) }
    return <group key={section.id} position={[0, level.elevation + offset(level), 0]}>
      <RoofAssembly bounds={bounds} roof={section.roof} framingSpacing={section.framingSpacing}
        footprint={section.followFootprint ? section.footprint : undefined} voids={section.voids} />
    </group>
  })}</>
}
