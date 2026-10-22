import {afterEach,expect,test} from 'bun:test'
import {useProject} from '../src/state/project'
import {houseSample} from '../src/domain/residentialSamples'
import {activateOverlay,releaseOverlay,closeFloatingOverlay,overlayIsActive} from '../src/app/overlayCoordinator'
afterEach(()=>{closeFloatingOverlay();useProject.getState().setEditLocked(false);useProject.getState().setReadOnly(false);useProject.getState().setProject(null)})
test('opening a floating interface closes the previous owner without releasing the new owner',()=>{
  const first=Symbol(),next=Symbol();let closed=0
  activateOverlay(first,()=>{closed++;expect(releaseOverlay(first)).toBe(false)})
  activateOverlay(next,()=>{closed++})
  expect(closed).toBe(1);expect(overlayIsActive(next)).toBe(true)
  closeFloatingOverlay();expect(closed).toBe(2);expect(overlayIsActive(next)).toBe(false)
})
test('approved application blocks concurrent local edits and creates a complete single Undo checkpoint',()=>{
  const before=houseSample(),state=useProject.getState();state.setProject(before);state.setEditLocked(true)
  const snapshot=structuredClone(useProject.getState().project!)
  state.editProject(p=>({...p,name:'Racing edit'}));state.edit(m=>({...m,walls:[]}));state.undo();state.redo()
  expect(useProject.getState().project).toEqual(snapshot)
  const accepted=structuredClone(snapshot);accepted.buildings[0].levels[0].rooms[0].name='Accepted room';accepted.buildings[0].roof!.pitch=12
  state.adoptDocument(accepted);state.rememberAccepted(snapshot);state.setEditLocked(false)
  expect(useProject.getState().history).toHaveLength(1)
  state.undo();expect(useProject.getState().project).toEqual(snapshot)
  state.redo();expect(useProject.getState().project!.buildings[0].roof!.pitch).toBe(12)
})
