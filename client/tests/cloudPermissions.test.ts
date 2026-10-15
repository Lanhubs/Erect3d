import { expect, test } from 'bun:test'
import { useProject } from '../src/state/project'
import { fixtureProject } from '../src/domain/fixture'
test('read-only projects block every store edit path but still allow level and camera navigation', () => {
  const store = useProject.getState(); store.setReadOnly(false); store.setProject(fixtureProject('Read only'))
  const before = structuredClone(useProject.getState().project)
  store.setReadOnly(true)
  store.editProject(project => ({ ...project, name: 'Changed' })); store.edit(model => ({ ...model, walls: [] }))
  store.replaceDocument({ ...before!, name: 'Replaced' }); store.preview({ ...before!, name: 'Dragged' })
  store.undo(); store.redo(); store.setTool('wall'); store.setView('model')
  expect(useProject.getState().project).toEqual(before); expect(useProject.getState().tool).toBe('select')
  expect(useProject.getState().view).toBe('model'); expect(useProject.getState().dirty).toBe(false)
  store.setReadOnly(false); store.setProject(null)
})
test('an accepted remote proposal can be undone as one ordinary editor action', () => {
  const store = useProject.getState(); store.setReadOnly(false)
  const before = fixtureProject('Before proposal'), after = structuredClone(before)
  after.buildings[0].levels[0].walls[0].height = 4
  store.setProject(after); store.rememberAccepted(before); store.undo()
  expect(useProject.getState().project!.buildings[0].levels[0].walls[0].height).toBe(before.buildings[0].levels[0].walls[0].height)
  expect(useProject.getState().dirty).toBe(true)
  store.redo(); expect(useProject.getState().project!.buildings[0].levels[0].walls[0].height).toBe(4)
  store.setProject(null)
})
test('equivalent backend refreshes preserve proposal Undo and Redo despite missing optional defaults', () => {
  const store=useProject.getState();store.setReadOnly(false)
  store.setProject(fixtureProject('Proposal refresh'))
  const before=structuredClone(useProject.getState().project!),after=structuredClone(before)
  after.buildings[0].levels[0].walls[0].height=4
  delete after.buildings[0].levels[0].passages
  store.setProject(after);store.rememberAccepted(before)
  store.adoptDocument(structuredClone(after));store.adoptDocument(structuredClone(after))
  store.undo();expect(useProject.getState().project!.buildings[0].levels[0].walls[0].height).toBe(before.buildings[0].levels[0].walls[0].height)
  store.adoptDocument(structuredClone(useProject.getState().project!))
  store.redo();expect(useProject.getState().project!.buildings[0].levels[0].walls[0].height).toBe(4)
  const remote=structuredClone(after);remote.name='Collaborator update';store.adoptDocument(remote)
  expect(useProject.getState().history).toHaveLength(0)
  store.setProject(null)
})
