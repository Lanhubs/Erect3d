import type { Building, Level, Project, SourceDocument } from './types'
import { initialAutoScale } from '../geometry/autoScale'

const collections = [
  'walls',
  'doors',
  'windows',
  'passages',
  'rooms',
  'slabs',
  'columns',
  'stairs',
  'ramps',
  'seatingSections',
  'details',
  'stairGuides',
  'furniture',
] as const
export const hasLevelGeometry = (level: Level, building?: Building) =>
  collections.some((key) => level[key]?.length) ||
  Boolean(
    building?.roofSections?.some((section) => section.levelId === level.id) ||
    building?.systems?.systems.some((system) => system.levelId === level.id) ||
    building?.architecture?.sourceLevelId === level.id,
  )

// A source replacement is one document change. Never leave objects in the old
// source's coordinates, or connections referring to geometry that no longer exists.
export function replaceSource(project: Project, document: SourceDocument, levelId?: string) {
  const copy = structuredClone(project)
  const building =
    copy.buildings.find((item) => item.levels.some((level) => level.id === levelId)) || copy.buildings[0]
  const level = building.levels.find((item) => item.id === levelId) || building.levels[0]
  const legacy =
    !copy.buildings.some((item) => item.levels.some((floor) => floor.sourceId)) &&
    level === copy.buildings[0].levels[0]
  const previous = level.sourceId || (legacy ? copy.sources[0]?.id : undefined)
  const otherUses = Boolean(
    previous &&
    copy.buildings.some((item) =>
      item.levels.some((floor) => floor !== level && floor.sourceId === previous),
    ),
  )
  copy.sources = [...copy.sources.filter((item) => item.id !== previous || otherUses), document]
  level.sourceId = document.id
  level.calibration = initialAutoScale(document.width, document.height)
  if (level === copy.buildings[0].levels[0]) copy.calibration = level.calibration
  if (previous) {
    const removed = new Set(collections.flatMap((key) => (level[key] || []).map((item) => item.id)))
    const openings = new Set<string>()
    for (const floor of building.levels) {
      floor.stairs = floor.stairs?.filter((stair) => {
        if (stair.fromLevelId !== level.id && stair.toLevelId !== level.id) return true
        removed.add(stair.id)
        if (stair.openingId) openings.add(stair.openingId)
        return false
      })
    }
    for (const key of collections) level[key] = []
    for (const floor of building.levels)
      for (const slab of floor.slabs || []) {
        slab.openings = slab.openings.filter((opening) => !openings.has(opening.id))
      }
    building.roofSections = building.roofSections?.filter((section) => {
      if (section.levelId !== level.id) return true
      removed.add(section.id)
      return false
    })
    if (building.systems)
      building.systems.systems = building.systems.systems.filter((system) => {
        if (
          system.levelId !== level.id &&
          !(system.kind === 'typical-floors' && system.templateLevelId === level.id)
        )
          return true
        removed.add(system.id)
        return false
      })
    if (building.architecture?.sourceLevelId === level.id) {
      removed.add(building.architecture.id)
      delete building.architecture
    }
    if (copy.interpretation) for (const id of removed) delete copy.interpretation[id]
  }
  copy.modified = Date.now()
  return { project: copy, previous, otherUses }
}
