import { defaultRoof, type Building, type Level, type RoofSection } from './types'
import { wallEnvelope } from './levels'
import { generatedRoof } from './roofDesign'
import { roofRegions } from '../geometry/roofRegions'
import type { TypicalFloorGroup } from './buildingSystems'

const levelFootprints = (level: Level) =>
  level.rooms.length
    ? level.rooms.map((room) => room.polygon)
    : level.slabs?.length
      ? level.slabs.map((slab) => slab.polygon)
      : [wallEnvelope(level)].filter((ring) => ring.length >= 3)

export function effectiveRoofSections(building: Building): RoofSection[] {
  const sections = building.roofSections || [],
    result = sections.filter((section) => !generatedRoof(section))
  const canopy = sections.find(
    (section) => section.id === building.architecture?.roofSectionId && generatedRoof(section),
  )
  // A long-span canopy belongs to the whole arena, above the concourse. Its
  // identity and surface must not be subtracted by that intermediate floor.
  if (canopy) result.push(canopy)
  for (const level of building.levels) {
    // Generated roofing requires erected support, not only stale room/slab footprints.
    if (
      level.sourceId &&
      !level.walls.some((wall) => wall.height > 0) &&
      !level.columns?.some((column) => column.height > 0)
    )
      continue
    const assigned = sections.filter((section) => section.levelId === level.id && section.id !== canopy?.id)
    if (canopy?.levelId === level.id && !assigned.length) continue
    const automatic = assigned.filter(generatedRoof)
    if ((assigned.length && !automatic.length) || (!assigned.length && level.autoRoof === false)) continue
    const repetitions = (building.systems?.systems || []).filter(
      (system): system is TypicalFloorGroup =>
        system.kind === 'typical-floors' && system.visible !== false && system.templateLevelId === level.id,
    )
    const roofElevation = Math.max(
      level.elevation,
      ...repetitions.map(
        (group) =>
          (building.levels.find((host) => host.id === group.levelId)?.elevation || 0) +
          group.elevation +
          (group.count - 1) * group.floorHeight,
      ),
    )
    const higher = building.levels
      .filter((item) => item.elevation > roofElevation + 0.1)
      .flatMap(levelFootprints)
    const groups = new Map<string, RoofSection[]>()
    automatic.forEach((section) => {
      const key = JSON.stringify([section.roof, section.topHeight, section.framingSpacing])
      groups.set(key, [...(groups.get(key) || []), section])
    })
    const designs = automatic.length ? [...groups.values()] : [[]]
    designs.forEach((sections, design) => {
      const polygons = sections.length ? sections.map((section) => section.footprint) : levelFootprints(level)
      const regions = roofRegions(polygons, [
        ...sections.flatMap((section) => section.voids || []),
        ...higher,
      ])
      regions.forEach((region, index) =>
        result.push({
          id: `visible-roof:${level.id}:${design}:${index}`,
          name: 'Building roof',
          levelId: level.id,
          ...region,
          automatic: true,
          followFootprint: true,
          roof: sections[0]?.roof || building.roof || level.roof || defaultRoof,
          topHeight:
            sections[0]?.topHeight ??
            (repetitions.length
              ? roofElevation -
                level.elevation +
                Math.max(level.floorToFloorHeight || 3, ...level.walls.map((w) => w.height))
              : undefined),
          framingSpacing: sections[0]?.framingSpacing,
        }),
      )
    })
  }
  return result
}
