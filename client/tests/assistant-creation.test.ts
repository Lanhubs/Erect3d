import { expect, test } from 'bun:test'
import { buildingCreationBrief, creationScope } from '../src/domain/assistantCreation'
import { fixtureProject } from '../src/domain/fixture'

const prompt =
  'craft for me a 2 storey buiding mansion with amazing furnintures in it and also make the building look like a chinese architecture'
test('the exact creation brief becomes building scope without requiring a selection or an upper floor', () => {
  const p = fixtureProject(),
    b = p.buildings[0],
    l = b.levels[0]
  expect(buildingCreationBrief(prompt)).toEqual({ message: prompt, storeys: 2, furnished: true })
  expect(creationScope(p, { mode: 'selection', buildingId: b.id, levelId: l.id }, prompt)).toEqual({
    mode: 'building',
    buildingId: b.id,
    levelId: l.id,
  })
  expect(creationScope(p, undefined, prompt)?.mode).toBe('building')
})
test('new architectural styles and ordinary creation wording are accepted without a preset whitelist', () => {
  for (const text of [
    'design a three-storey Moroccan courtyard house',
    'build me a five story office building',
    'create a new Scandinavian villa from scratch',
    'generate a 12 storey hotel',
  ])
    expect(buildingCreationBrief(text)).toBeDefined()
})
test('existing-building edits and negative requests do not silently replace the building', () => {
  for (const text of [
    'make this building look Chinese',
    'make the building look like Chinese architecture',
    'create a balcony for this house',
    'build a wall in this room',
    'add furniture to the second floor',
    'do not create a new house',
    'improve this floor',
  ])
    expect(buildingCreationBrief(text)).toBeUndefined()
})
