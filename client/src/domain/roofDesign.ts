import { defaultRoof, uid, type Building, type Level, type Roof } from './types'
import { roofRegions } from '../geometry/roofRegions'

export const generatedRoof = (section: NonNullable<Building['roofSections']>[number]) =>
  section.automatic === true || section.followFootprint === true && /^Plan roof \d+$/.test(section.name)

export function rebuildImportedRoof(building: Building, level: Level) {
  if(building.architecture?.sourceLevelId===level.id && building.roofSections?.some(section=>section.id===building.architecture!.roofSectionId))return
  const retained = (building.roofSections || []).filter(section => section.levelId !== level.id || !generatedRoof(section))
  const regions = roofRegions(level.rooms.map(room => room.polygon))
  const roof = building.roof || level.roof || defaultRoof
  building.roofSections = [...retained, ...regions.map((region, index) => ({ id: uid('roof-section'),
    name: regions.length === 1 ? 'Building roof' : `Building roof ${index + 1}`, levelId: level.id,
    ...region, automatic: true, followFootprint: true, roof: { ...roof } }))]
}

export function setBuildingRoof(building: Building, change: Partial<Roof>) {
  repairImportedRoofs(building)
  const top = building.levels.reduce((a, b) => a.elevation >= b.elevation ? a : b)
  const next = { ...(building.roof || top.roof || defaultRoof), ...change }
  building.roof = next; top.roof = next
  building.levels.forEach(level => { level.roof = { ...(level.roof || next), ...change } })
  building.roofSections?.forEach(section => { section.roof = { ...section.roof, ...change } })
}

export function repairImportedRoofs(building: Building) {
  for (const level of building.levels) if (building.roofSections?.some(section => section.levelId === level.id &&
    section.followFootprint && /^Plan roof \d+$/.test(section.name))) rebuildImportedRoof(building, level)
}
