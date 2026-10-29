import { executeTool } from './tools'
import type { EditWorkspace } from './edits'
import { collections } from './entities'
import { scopeContext } from './scope'
import { requestsFloorReview, reviewFloor } from './floor-review'

export function editingContext(work: EditWorkspace, message = '') {
  const { building, level } = scopeContext(work.document, work.scope)
  const entry = Object.entries(collections).find(([, field]) =>
    (level[field] as { id: string }[] | undefined)?.some((item) => item.id === work.scope.entityId),
  )
  const selection = entry
    ? { kind: entry[0], ...executeTool(work, 'inspect_entity', { kind: entry[0], id: work.scope.entityId }) }
    : undefined
  return {
    scope: work.scope,
    buildingId: building.id,
    activeLevelId: level.id,
    units: 'metres',
    model: executeTool(work, 'inspect_model', {}),
    targetFloor: executeTool(work, 'inspect_level', { levelId: level.id }),
    selection,
    furnitureCatalog: executeTool(work, 'inspect_schema', { kind: 'furniture' }),
    ...(work.creation
      ? {
          creation: work.creation,
          creationGuidance:
            'Use design_building to prepare every requested storey, furnishings, architectural styling and connected circulation together. Do not ask the user to select an existing floor. Dimensions not specified in the brief may be reasonable design assumptions, stated in the summary. Existing model remains untouched until Apply.',
        }
      : {}),
    ...(requestsFloorReview(message) ? { floorReview: reviewFloor(work, level.id) } : {}),
    note: 'Actual working model. selection is the exact selected entity, even when omitted from the capped targetFloor lists. For a selected room, use its actual polygon and room ID. Never substitute another room. Batch further inspections. Three responses remain. Earlier proposals are context only.',
  }
}

export const claimsPreparedChanges = (text: string) =>
  /\b(?:prepared|ready to (?:preview|apply)|would (?:add|place|create|change)|have (?:added|placed|updated))\b/i.test(
    text,
  )
