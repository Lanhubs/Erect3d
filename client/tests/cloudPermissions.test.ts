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
