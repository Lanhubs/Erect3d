import { z } from 'zod'
import { id } from '../../contracts/primitives'
import { wall, room, door, windowUnit } from '../../contracts/elements'
import type { EditWorkspace } from './edits'
import { scopeContext } from './scope'
import { roofRegions } from '../../../../client/src/geometry/roofRegions'
import { newSlab } from '../../../../client/src/domain/levels'
import { polygonArea } from '../../../../client/src/geometry/quantities'
import { sourceCoverage } from '../plan-analysis/source-coverage'

const hostRef = { hostRef: id }
export const floorDesign = z
  .object({
    levelId: id,
    rooms: z
      .array(room.omit({ id: true }))
      .min(1)
      .max(60),
    walls: z
      .array(wall.omit({ id: true }).extend({ ref: id }))
      .min(3)
      .max(200),
    doors: z
      .array(door.omit({ id: true, wallId: true }).extend(hostRef))
      .min(1)
      .max(100),
    windows: z.array(windowUnit.omit({ id: true, wallId: true }).extend(hostRef)).max(100),
  })
  .strict()

// Gemini authors the actual plan. This compiler resolves only local references and
// geometry ownership; it does not substitute a canned house or execute provider code.
export function designFloor(work: EditWorkspace, input: z.infer<typeof floorDesign>) {
  const { building } = scopeContext(work.document, work.scope)
  const level = building.levels.find((level) => level.id === input.levelId)
  if (
    !level ||
    work.scope.mode === 'selection' ||
    (work.scope.mode !== 'building' && level.id !== work.scope.levelId)
  )
    throw new Error('Choose This floor or Whole building for a new floor layout')
  if (
    level.locked ||
    level.walls.length ||
    level.rooms.length ||
    level.slabs?.length ||
    level.furniture?.length ||
    level.columns?.length ||
    level.stairs?.length ||
    level.ramps?.length ||
    level.details?.length
  )
    throw new Error(
      'Design a layout on an empty, unlocked floor; use edit_model to improve an existing layout',
    )
  const before = structuredClone(work.document),
    allowed = new Set(work.allowed),
    count = work.descriptions.length
  try {
    const refs = new Map<string, string>()
    for (const { ref, ...properties } of input.walls) {
      if (refs.has(ref)) throw new Error('Each wall reference must be unique')
      const created = work.apply({
        action: 'create',
        kind: 'wall',
        levelId: level.id,
        properties: JSON.stringify(properties),
      }) as { id: string }
      refs.set(ref, created.id)
    }
    const rooms = input.rooms.map((properties) =>
      work.apply({
        action: 'create',
        kind: 'room',
        levelId: level.id,
        properties: JSON.stringify(properties),
      }),
    )
    for (const [kind, items] of [
      ['door', input.doors],
      ['window', input.windows],
    ] as const) {
      for (const { hostRef, ...properties } of items) {
        const wallId = refs.get(hostRef)
        if (!wallId) throw new Error('An opening references a wall not present in this floor design')
        work.apply({
          action: 'create',
          kind,
          levelId: level.id,
          properties: JSON.stringify({ ...properties, wallId }),
        })
      }
    }
    const regions = roofRegions(input.rooms.map((room) => room.polygon))
    const total = input.rooms.reduce((sum, room) => sum + polygonArea(room.polygon), 0)
    const joined = regions.reduce(
      (sum, r) => sum + polygonArea(r.footprint) - r.voids.reduce((s, h) => s + polygonArea(h), 0),
      0,
    )
    if (joined < total - 0.05)
      throw new Error('Rooms must have distinct, non-overlapping interior footprints')
    for (const region of regions) {
      const { id: _slabId, ...properties } = newSlab(region.footprint, level.slabThickness)
      properties.autoFromWalls = false
      properties.openings = region.voids.map((polygon, i) => ({
        id: `design_void_${crypto.randomUUID()}_${i}`,
        polygon,
        kind: 'void' as const,
      }))
      work.apply({
        action: 'create',
        kind: 'slab',
        levelId: level.id,
        properties: JSON.stringify(properties),
      })
    }
    const access = sourceCoverage({ candidates: [] }, work.document, level.id).find(
      (issue) => issue.code === 'ROOM_NO_ACCESS',
    )
    if (access) throw new Error(access.message)
    const proposal = work.proposal()
    return {
      rooms,
      walls: Object.fromEntries(refs),
      changes: proposal.changes.length,
      note: 'Layout prepared on the working copy, not applied. Use returned IDs to furnish rooms or connect upper floors.',
    }
  } catch (error) {
    work.document = before
    work.allowed = allowed
    work.descriptions.length = count
    throw error
  }
}
