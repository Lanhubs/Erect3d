import type { EditWorkspace } from './edits'
import { scopeContext } from './scope'
import { furnitureIssues } from '../../../../client/src/furniture/entities'
import { wallLength } from '../../../../client/src/geometry/math'
import { sourceCoverage } from '../plan-analysis/source-coverage'

export function reviewFloor(work: EditWorkspace, levelId: string) {
  const { building } = scopeContext(work.document, work.scope)
  const level = building.levels.find((level) => level.id === levelId)
  if (!level) throw new Error('Choose a floor in the selected building')
  const issues: { kind: string; id: string; name?: string; message: string; entity?: unknown }[] = []
  for (const item of level.furniture || []) {
    for (const message of furnitureIssues(item, level, building.levels).issues)
      issues.push({
        kind: 'furniture',
        id: item.id,
        name: item.type.replaceAll('-', ' '),
        message,
        entity: item,
      })
  }
  const walls = new Map(level.walls.map((wall) => [wall.id, wall]))
  for (const [kind, items] of [
    ['door', level.doors],
    ['window', level.windows],
    ['passage', level.passages || []],
  ] as const) {
    for (const item of items) {
      const wall = walls.get(item.wallId),
        sill = 'sill' in item ? item.sill : 0
      if (
        !wall ||
        item.offset < 0 ||
        item.offset + item.width > wallLength(wall) + 0.001 ||
        sill + item.height > wall.height + 0.001
      )
        issues.push({
          kind,
          id: item.id,
          message: 'Opening does not fit its existing host wall.',
          entity: item,
        })
    }
  }
  for (const issue of sourceCoverage({ candidates: [] }, work.document, levelId)) {
    const room = level.rooms.find((room) =>
      issue.message.startsWith(`${room.name} has no identified entrance`),
    )
    issues.push({
      kind: 'room',
      id: room?.id || issue.candidateId || level.id,
      message: issue.message,
      ...(room ? { name: room.name, entity: room } : {}),
    })
  }
  return {
    levelId: level.id,
    name: level.name,
    checked: {
      rooms: level.rooms.length,
      walls: level.walls.length,
      openings: level.doors.length + level.windows.length + (level.passages?.length || 0),
      furniture: level.furniture?.length || 0,
    },
    issues: issues.slice(0, 80),
    totalIssues: issues.length,
    note: 'Checked the complete floor, not only the first summary page. These diagnostics are design checks, not engineering certification. Prepare specific safe edits for supported findings. Inspect related entities before changing walls or circulation. Missing source evidence is not permission to invent openings. An issue-free review may explain its findings without fabricating an edit.',
  }
}

export const requestsFloorReview = (message: string) =>
  /\b(?:review|improve|audit|check)\b[\s\S]{0,80}\b(?:this|current|active|the)\s+floor\b/i.test(message)
