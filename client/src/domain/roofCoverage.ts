import { defaultRoof, type Building, type Level, type RoofSection } from './types'
import { wallEnvelope } from './levels'
import { generatedRoof } from './roofDesign'
import { roofRegions } from '../geometry/roofRegions'

const levelFootprints = (level: Level) => level.rooms.length ? level.rooms.map(room => room.polygon)
  : level.slabs?.length ? level.slabs.map(slab => slab.polygon) : [wallEnvelope(level)].filter(ring => ring.length >= 3)

export function effectiveRoofSections(building: Building): RoofSection[] {
  const sections = building.roofSections || [], result = sections.filter(section => !generatedRoof(section))
  for (const level of building.levels) {
    const assigned = sections.filter(section => section.levelId === level.id)
    const automatic = assigned.filter(generatedRoof)
    if (assigned.length && !automatic.length || !assigned.length && level.autoRoof === false) continue
    const higher = building.levels.filter(item => item.elevation > level.elevation + .1).flatMap(levelFootprints)
    const groups = new Map<string, RoofSection[]>()
    automatic.forEach(section => { const key = JSON.stringify([section.roof, section.topHeight, section.framingSpacing])
      groups.set(key, [...(groups.get(key) || []), section]) })
    const designs = automatic.length ? [...groups.values()] : [[]]
    designs.forEach((sections, design) => {
      const polygons = sections.length ? sections.map(section => section.footprint) : levelFootprints(level)
      const regions = roofRegions(polygons, [...sections.flatMap(section => section.voids || []), ...higher])
      regions.forEach((region, index) => result.push({ id: `visible-roof:${level.id}:${design}:${index}`, name: 'Building roof', levelId: level.id,
        ...region, automatic: true, followFootprint: true, roof: sections[0]?.roof || building.roof || level.roof || defaultRoof,
        topHeight: sections[0]?.topHeight, framingSpacing: sections[0]?.framingSpacing }))
    })
  }
  return result
}
