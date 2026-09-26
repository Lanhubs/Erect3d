import { create } from 'zustand'
import type { Door, Passage, Project, Roof, Room, Selection, Wall, WindowUnit } from '../domain/types'
import { levelOf } from '../domain/types'

export type Tool = 'select' | 'pan' | 'wall' | 'door' | 'window' | 'room' | 'measure' | 'calibrate'
export type View = 'plan' | 'split' | 'model'
export type GridSettings = { visible: boolean; snap: boolean; step: number; angle: number; length: number }
type Model = { walls: Wall[]; doors: Door[]; windows: WindowUnit[]; passages: Passage[]; rooms: Room[]; roof?: Roof }
type State = {
  project: Project | null; selection: Selection; tool: Tool; view: View; grid: GridSettings; history: Model[]; future: Model[]; dirty: boolean; version: number
  setProject: (project: Project | null) => void; setSelection: (selection: Selection) => void
  setTool: (tool: Tool) => void; setView: (view: View) => void; setGrid: (change: Partial<GridSettings>) => void; edit: (change: (model: Model) => Model) => void
  undo: () => void; redo: () => void; markSaved: (version: number) => void
}
const snapshot = (project: Project): Model => {
  const { walls, doors, windows, passages, rooms, roof } = levelOf(project)
  return structuredClone({ walls, doors, windows, passages: passages || [], rooms, roof })
}
const replace = (project: Project, model: Model): Project => {
  const copy = structuredClone(project)
  Object.assign(levelOf(copy), model)
  copy.modified = Date.now()
  return copy
}
export const useProject = create<State>((set, get) => ({
  project: null, selection: null, tool: 'select', view: 'split', grid: { visible: true, snap: false, step: .1, angle: 0, length: 0 }, history: [], future: [], dirty: false, version: 0,
  setProject: project => set({ project, selection: null, history: [], future: [], dirty: false, version: 0 }),
  setSelection: selection => set({ selection }), setTool: tool => set({ tool }), setView: view => set({ view }),
  setGrid: change => set(state => ({ grid: { ...state.grid, ...change } })),
  edit: change => {
    const { project, history } = get()
    if (!project) return
    const before = snapshot(project)
    set({ project: replace(project, change(before)), history: [...history.slice(-49), before], future: [], dirty: true, version: get().version + 1 })
  },
  undo: () => {
    const { project, history, future } = get()
    if (!project || !history.length) return
    set({ project: replace(project, history.at(-1)!), history: history.slice(0, -1), future: [...future, snapshot(project)], dirty: true, version: get().version + 1 })
  },
  redo: () => {
    const { project, history, future } = get()
    if (!project || !future.length) return
    set({ project: replace(project, future.at(-1)!), history: [...history, snapshot(project)], future: future.slice(0, -1), dirty: true, version: get().version + 1 })
  },
  markSaved: version => { if (get().version === version) set({ dirty: false }) },
}))
