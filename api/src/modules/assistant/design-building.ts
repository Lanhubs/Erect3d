import type { BuildingDesign } from './building-design-schema'
import type { EditWorkspace } from './edits'
import { designFloor } from './design-floor'
import { connectStair } from './stair'
import { scopeContext } from './scope'
import { blankLevel } from '../../../../client/src/domain/levels'
import { type Building } from '../../../../client/src/domain/types'
import { furnitureIssues } from '../../../../client/src/furniture/entities'
import { repairGeneratedFence } from '../../../../client/src/geometry/site'

export function designBuilding(work: EditWorkspace, input: BuildingDesign) {
  if (work.scope.mode !== 'building' || !work.creation)
    throw new Error(
      'Use a new-building design brief to prepare a complete building. Existing element edits use edit_model.',
    )
  const { building: current } = scopeContext(work.document, work.scope)
  if (current.levels.some((level) => level.locked))
    throw new Error('Unlock the existing floors before preparing a replacement building design.')
  if (work.creation.storeys && input.floors.length !== work.creation.storeys)
    throw new Error(
      `The brief requests ${work.creation.storeys} storeys; supply that many real floor layouts, not repeated roof levels.`,
    )
  const before = structuredClone(work.document),
    count = work.descriptions.length,
    allowed = new Set(work.allowed),
    focus = work.focusLevelId
  const originalScope = { ...work.scope }
  try {
    let elevation = 0
    const refs = new Map<string, string>()
    const levels = input.floors.map((floor, index) => {
      if (refs.has(floor.ref)) throw new Error('Each floor needs a unique local reference')
      const level = blankLevel(floor.name, elevation, floor.height)
      if (!index) level.id = current.levels[0].id
      elevation += floor.height
      level.autoSlab = false
      level.autoRoof = index === input.floors.length - 1
      refs.set(floor.ref, level.id)
      return level
    })
    const building: Building = {
      id: current.id,
      name: input.name,
      levels,
      roof: input.roof,
      ...(current.siteFence ? { siteFence: structuredClone(current.siteFence) } : {}),
    }
    work.document.buildings[work.document.buildings.findIndex((b) => b.id === current.id)] = building
    work.scope.levelId = levels[0].id
    for (const [index, floor] of input.floors.entries()) {
      const level = levels[index]
      designFloor(work, { ...floor.layout, levelId: level.id })
      for (const properties of floor.columns || [])
        work.apply({
          action: 'create',
          kind: 'column',
          levelId: level.id,
          properties: JSON.stringify(properties),
        })
      for (const properties of floor.details || [])
        work.apply({
          action: 'create',
          kind: 'detail',
          levelId: level.id,
          properties: JSON.stringify(properties),
        })
      for (const properties of floor.roofs || [])
        work.apply({
          action: 'create',
          kind: 'roof-section',
          levelId: level.id,
          properties: JSON.stringify({ ...properties, levelId: level.id }),
        })
    }
    for (let index = 1; index < levels.length; index++) {
      const connections = input.stairs.filter(
        (stair) =>
          refs.get(stair.fromRef) === levels[index - 1].id && refs.get(stair.toRef) === levels[index].id,
      )
      if (!connections.length)
        throw new Error(
          `Provide a connected stair and clear aligned stairwell from ${levels[index - 1].name} to ${levels[index].name}.`,
        )
    }
    for (const stair of input.stairs) {
      const from = refs.get(stair.fromRef),
        to = refs.get(stair.toRef)
      if (!from || !to) throw new Error('Stair references must identify floors in this design')
      connectStair(work.document, building, {
        action: 'connect-stair',
        levelId: from,
        toLevelId: to,
        form: stair.form,
        width: stair.width,
        start: stair.start,
      })
      work.descriptions.push(`connect stair ${stair.fromRef} to ${stair.toRef}`)
    }
    for (const [index, floor] of input.floors.entries()) {
      const level = levels[index]
      if (work.creation.furnished && !floor.furniture.length)
        throw new Error(`Furnish ${floor.name} as requested; furniture descriptions alone are not a model.`)
      for (const { roomName, ...properties } of floor.furniture) {
        const rooms = level.rooms.filter((room) => room.name === roomName)
        if (rooms.length !== 1)
          throw new Error(`Furniture must name one exact room in ${floor.name}: ${roomName}`)
        const object = work.apply({
          action: 'create',
          kind: 'furniture',
          levelId: level.id,
          properties: JSON.stringify({ ...properties, roomId: rooms[0].id }),
        }) as NonNullable<typeof level.furniture>[number]
        const problems = furnitureIssues(object, level, levels).issues.filter(
          (issue) => !issue.startsWith('Confirm that'),
        )
        if (problems.length)
          throw new Error(`${floor.name}, ${roomName}, ${object.type}: ${problems.join('; ')}`)
      }
    }
    work.focusLevelId = levels[0].id
    work.descriptions.push(`Design ${input.floors.length}-storey ${input.style} building`)
    repairGeneratedFence(building)
    const proposal = work.proposal()
    return {
      buildingId: building.id,
      focusLevelId: work.focusLevelId,
      storeys: levels.length,
      changes: proposal.changes.length,
      floors: levels.map((l) => ({
        id: l.id,
        name: l.name,
        rooms: l.rooms.map((r) => ({ id: r.id, name: r.name })),
        furniture: l.furniture?.length || 0,
      })),
      note: 'Complete editable building prepared. It would replace the current building only after Apply; the saved model is unchanged and one Undo restores it. Review the architecture and assumptions.',
    }
  } catch (error) {
    work.document = before
    Object.assign(work.scope, originalScope)
    work.allowed = allowed
    work.focusLevelId = focus
    work.descriptions.length = count
    throw error
  }
}
