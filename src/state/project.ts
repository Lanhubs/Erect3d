import { create } from 'zustand'
import type { Door, Passage, Project, Roof, Room, Selection, Wall, WindowUnit } from '../domain/types'
import { activeLevel } from '../domain/types'
import { normalizeProject } from '../domain/levels'

export type Tool = 'select' | 'pan' | 'wall' | 'door' | 'window' | 'room' | 'measure' | 'calibrate'
export type View = 'plan' | 'split' | 'model'
export type GridSettings = { visible: boolean; snap: boolean; step: number; angle: number; length: number }
type Model = { walls: Wall[]; doors: Door[]; windows: WindowUnit[]; passages: Passage[]; rooms: Room[]; roof?: Roof }
type State = {
  project: Project | null; activeLevelId: string | null; selection: Selection; tool: Tool; view: View; grid: GridSettings
  history: Project[]; future: Project[]; dirty: boolean; version: number
  setProject: (project: Project | null) => void; setActiveLevel: (id: string) => void; setSelection: (selection: Selection) => void
  setTool: (tool: Tool) => void; setView: (view: View) => void; setGrid: (change: Partial<GridSettings>) => void
  edit: (change: (model: Model) => Model) => void; editProject: (change: (project: Project) => Project) => void
  undo: () => void; redo: () => void; markSaved: (version: number) => void
}
const commit = (set: (change: Partial<State>) => void, state: State, next: Project) => {
  next.modified = Date.now()
  set({ project: next, history: [...state.history.slice(-49), state.project!], future: [],
    dirty: true, version: state.version + 1 })
}
export const useProject = create<State>((set, get) => ({
  project: null, activeLevelId: null, selection: null, tool: 'select', view: 'split',
  grid: { visible: true, snap: false, step: .1, angle: 0, length: 0 }, history: [], future: [], dirty: false, version: 0,
  setProject: input => {
    const project = input ? normalizeProject(input) : null
    set({ project, activeLevelId: project?.buildings[0].levels[0].id || null, selection: null,
      history: [], future: [], dirty: false, version: 0 })
  },
  setActiveLevel: id => set({ activeLevelId: id, selection: null }),
  setSelection: selection => set({ selection }), setTool: tool => set({ tool }), setView: view => set({ view }),
  setGrid: change => set(state => ({ grid: { ...state.grid, ...change } })),
  editProject: change => {
    const state = get()
    if (!state.project) return
    commit(set, state, change(structuredClone(state.project)))
  },
  edit: change => {
    const state = get()
    if (!state.project) return
    const next = structuredClone(state.project)
    const level = activeLevel(next, state.activeLevelId)
    if (level.locked) return
    const before: Model = { walls: level.walls, doors: level.doors, windows: level.windows,
      passages: level.passages || [], rooms: level.rooms, roof: level.roof }
    Object.assign(level, change(before))
    commit(set, state, next)
  },
  undo: () => {
    const state = get()
    if (!state.project || !state.history.length) return
    const project = state.history.at(-1)!
    set({ project, activeLevelId: project.buildings[0].levels.some(level => level.id === state.activeLevelId)
      ? state.activeLevelId : project.buildings[0].levels[0].id,
      history: state.history.slice(0, -1), future: [...state.future, state.project], dirty: true, version: state.version + 1 })
  },
  redo: () => {
    const state = get()
    if (!state.project || !state.future.length) return
    const project = state.future.at(-1)!
    set({ project, activeLevelId: project.buildings[0].levels.some(level => level.id === state.activeLevelId)
      ? state.activeLevelId : project.buildings[0].levels[0].id,
      history: [...state.history, state.project], future: state.future.slice(0, -1), dirty: true, version: state.version + 1 })
  },
  markSaved: version => { if (get().version === version) set({ dirty: false }) },
}))
