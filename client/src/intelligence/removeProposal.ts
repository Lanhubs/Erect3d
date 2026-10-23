import type { Candidate } from '../../../api/src/contracts/analysis'
import type { Level, Project } from '../domain/types'
import { ProposalError } from './errors'

export function removeProposal(project: Project, level: Level, candidates: Candidate[]) {
  const removals = candidates.filter((item) => item.action === 'remove'),
    ids = new Set(removals.map((item) => item.targetId))
  for (const candidate of removals) {
    const id = candidate.targetId
    const key =
      candidate.kind === 'wall'
        ? 'walls'
        : candidate.kind === 'door'
          ? 'doors'
          : candidate.kind === 'window'
            ? 'windows'
            : candidate.kind === 'passage'
              ? 'passages'
              : candidate.kind === 'room'
                ? 'rooms'
                : candidate.kind === 'column'
                  ? 'columns'
                  : undefined
    const collection = key ? level[key] : undefined
    if (!id || !key || !collection?.some((item) => item.id === id))
      throw new ProposalError(
        422,
        'INVALID_TARGET',
        'Removal must reference an existing element of the reviewed kind',
      )
    if (candidate.kind === 'wall') {
      const dependent = [...level.doors, ...level.windows, ...(level.passages || [])].filter(
        (item) => item.wallId === id && !ids.has(item.id),
      )
      if (dependent.length)
        throw new ProposalError(
          422,
          'DEPENDENT_OPENINGS',
          'This wall still hosts doors or windows. Review their removal or reassign them before removing the wall.',
        )
    }
    if (candidate.kind === 'room' && level.furniture?.some((item) => item.roomId === id)) {
      throw new ProposalError(
        422,
        'DEPENDENT_OBJECTS',
        'This room still contains assigned objects. Reassign them before removing the room.',
      )
    }
  }
  for (const candidate of removals) {
    const id = candidate.targetId!
    if (candidate.kind === 'wall') level.walls = level.walls.filter((item) => item.id !== id)
    else if (candidate.kind === 'door') level.doors = level.doors.filter((item) => item.id !== id)
    else if (candidate.kind === 'window') level.windows = level.windows.filter((item) => item.id !== id)
    else if (candidate.kind === 'passage') level.passages = level.passages?.filter((item) => item.id !== id)
    else if (candidate.kind === 'room') level.rooms = level.rooms.filter((item) => item.id !== id)
    else if (candidate.kind === 'column') level.columns = level.columns?.filter((item) => item.id !== id)
    if (project.interpretation) delete project.interpretation[id]
  }
}
