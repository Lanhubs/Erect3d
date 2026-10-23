import type { Building, Level, RoofSection } from '../domain/types'
import { createRoofGeometryCache } from '../domain/roofGeometryCache'
import { RoofAssembly } from './RoofAssembly'
import { memo, useMemo } from 'react'
import { ArenaCanopy } from './ArenaCanopy'
import { systemRoofVoids } from '../geometry/systemRoofVoids'
const RoofSectionModel = memo(function RoofSectionModel({
  section,
  elevation,
  top,
  vision,
  canopy,
}: {
  section: RoofSection
  elevation: number
  top: number
  vision: Building['architecture']
  canopy: boolean
}) {
  const bounds = useMemo(
    () => ({
      minX: Math.min(...section.footprint.map((p) => p.x)),
      maxX: Math.max(...section.footprint.map((p) => p.x)),
      minZ: Math.min(...section.footprint.map((p) => p.z)),
      maxZ: Math.max(...section.footprint.map((p) => p.z)),
      top,
    }),
    [section.footprint, top],
  )
  return (
    <group position={[0, elevation, 0]}>
      {canopy && vision ? (
        <ArenaCanopy vision={vision} section={section} />
      ) : (
        <RoofAssembly
          bounds={bounds}
          roof={section.roof}
          framingSpacing={section.framingSpacing}
          footprint={section.footprint}
          voids={section.voids}
        />
      )}
    </group>
  )
})

export function BuildingRoofs({
  building,
  shown,
  offset,
  cutaway = false,
  singleLevel = false,
}: {
  building: Building
  shown: Level[]
  offset: (level: Level) => number
  cutaway?: boolean
  singleLevel?: boolean
}) {
  const vision = useMemo(
    () =>
      building.architecture && cutaway && building.architecture.brief.roofCoverage === 'full'
        ? {
            ...building.architecture,
            brief: { ...building.architecture.brief, roofCoverage: 'partial' as const },
          }
        : building.architecture,
    [building.architecture, cutaway],
  )
  const cachedSections = useMemo(() => createRoofGeometryCache(), [])
  const source = useMemo(() => cachedSections(building), [building, cachedSections])
  const elevations = building.levels.map((l) => `${l.id}:${l.elevation}`).join('|')
  const sections = useMemo(() => systemRoofVoids(building, source), [source, building.systems, elevations])
  return (
    <>
      {sections.map((section) => {
        const level = shown.find((item) => item.id === section.levelId)
        if (!level || section.footprint.length < 3) return null
        if (singleLevel && (section.topHeight || 0) > (level.floorToFloorHeight || 3) + 0.1) return null
        return (
          <RoofSectionModel
            key={section.id}
            section={section}
            elevation={level.elevation + offset(level)}
            top={section.topHeight || Math.max(2.7, ...level.walls.map((w) => w.height))}
            vision={vision}
            canopy={
              building.architecture?.roofSectionId === section.id && section.roof.shape === 'arena-vault'
            }
          />
        )
      })}
    </>
  )
}
