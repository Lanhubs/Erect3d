import { expect, test } from 'bun:test'
import { approvesAssistantProposal } from '../src/cloud/assistantIntent'
import { assistantSelection } from '../src/domain/assistantSelection'
import { fixtureProject } from '../src/domain/fixture'
import { blankLevel } from '../src/domain/levels'
import type { AssistantRun } from '../src/cloud/assistantTypes'

test('clear approval applies a ready proposal without another Gemini prompt; refinements remain prompts', () => {
  const run = { status: 'ready', proposal: {} } as AssistantRun
  for (const text of ['proceed', 'Yes, proceed', 'apply the changes', 'go ahead!', 'do it'])
    expect(approvesAssistantProposal(text, run)).toBe(true)
  for (const text of [
    'proceed but use blue',
    'do it in the kitchen instead',
    'yes, add two more couches',
    'what would you apply?',
  ])
    expect(approvesAssistantProposal(text, run)).toBe(false)
  expect(approvesAssistantProposal('proceed', { status: 'failed' } as AssistantRun)).toBe(false)
  expect(approvesAssistantProposal('proceed', null)).toBe(false)
})
test('selected room is resolved on its actual floor, independently of active floor or list caps', () => {
  const p = fixtureProject(),
    b = p.buildings[0],
    upper = blankLevel('Second floor', 6, 3)
  upper.rooms = Array.from({ length: 40 }, (_, i) => ({
    id: `room_${i}`,
    name: i === 39 ? 'Great room' : `Room ${i}`,
    material: 'tile' as const,
    polygon: [
      { x: 0, z: 0 },
      { x: 5, z: 0 },
      { x: 5, z: 5 },
      { x: 0, z: 5 },
    ],
  }))
  b.levels.push(upper)
  const result = assistantSelection(p, { id: 'room_39', kind: 'room' })
  expect(result?.level.id).toBe(upper.id)
  expect(result?.name).toBe('Great room')
})
