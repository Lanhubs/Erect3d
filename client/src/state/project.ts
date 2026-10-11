import { create } from 'zustand'
import type { Door, Passage, Project, Ramp, Roof, Room, SeatingSection, Selection, Wall, WindowUnit } from '../domain/types'
import { activeLevel } from '../domain/types'
import { normalizeProject, refreshAutoSlabs } from '../domain/levels'
import { repairGeneratedFence } from '../geometry/site'
import { shareUnchanged } from './shareUnchanged'

export type Tool = 'select' | 'pan' | 'wall' | 'curve' | 'ramp' | 'door' | 'window' | 'room' | 'measure' | 'calibrate'
export type View = 'plan' | 'split' | 'model'
export type GridSettings = { visible: boolean; snap: boolean; step: number; angle: number; length: number }
type Model = { walls: Wall[]; doors: Door[]; windows: WindowUnit[]; passages: Passage[]; rooms: Room[]; ramps: Ramp[]; seatingSections: SeatingSection[]; roof?: Roof }
type State = {
  project: Project | null; activeLevelId: string | null; selection: Selection; tool: Tool; view: View; grid: GridSettings; readOnly: boolean
  history: Project[]; future: Project[]; dirty: boolean; version: number; previewBase: Project | null
  preview: (project: Project) => void; finishPreview: () => void; cancelPreview: () => void
  setProject: (project: Project | null) => void; setActiveLevel: (id: string) => void; setSelection: (selection: Selection) => void
  setTool: (tool: Tool) => void; setView: (view: View) => void; setGrid: (change: Partial<GridSettings>) => void
  edit: (change: (model: Model) => Model) => void; editProject: (change: (project: Project) => Project) => void
  undo: () => void; redo: () => void; markSaved: (version: number) => void
  setReadOnly: (value: boolean) => void; replaceDocument: (project: Project) => void
}
const commit = (set: (change: Partial<State>) => void, state: State, next: Project) => {
  const project = shareUnchanged(state.project!, { ...next, modified: Date.now() })
  set({ project, history: [...state.history.slice(-49), state.project!], future: [],
    dirty: true, version: state.version + 1 })
}
export const useProject = create<State>((set, get) => ({
  project: null, activeLevelId: null, selection: null, tool: 'select', view: 'split', readOnly: false,
  grid: { visible: true, snap: false, step: .1, angle: 0, length: 0 }, history: [], future: [], dirty: false, version: 0, previewBase: null,
  setReadOnly: readOnly => { if (get().readOnly !== readOnly) { get().cancelPreview(); set({ readOnly, tool: 'select' }) } },
  replaceDocument: project => { if (!get().readOnly) get().editProject(() => project) },
  preview: project => { if (!get().readOnly) set(state => ({ previewBase: state.previewBase || state.project, project: state.project ? shareUnchanged(state.project, project) : project })) },
  finishPreview: () => {
    const state = get()
    if (!state.previewBase || !state.project) return
    commit(set, { ...state, project: state.previewBase }, state.project); set({ previewBase: null })
  },
  cancelPreview: () => { const state = get(); if (state.previewBase) set({ project: state.previewBase, previewBase: null }) },
  setProject: input => {
    const project = input ? normalizeProject(input) : null
    const previous = get()
    const keep = project?.id === previous.project?.id && project?.buildings[0].levels.some(level => level.id === previous.activeLevelId)
    set({ project, activeLevelId: keep ? previous.activeLevelId : project?.buildings[0].levels[0].id || null, selection: null,
      history: [], future: [], dirty: false, version: 0, previewBase: null })
  },
  setActiveLevel: id => { get().cancelPreview(); set({ activeLevelId: id, selection: null }) },
  setSelection: selection => { get().finishPreview(); set({ selection }) }, setTool: tool => { get().cancelPreview(); if (!get().readOnly || ['select','pan','measure'].includes(tool)) set({ tool }) }, setView: view => set({ view }),
  setGrid: change => set(state => ({ grid: { ...state.grid, ...change } })),
  editProject: change => {
    if (get().readOnly) return
    get().finishPreview()
    const state = get()
    if (!state.project) return
    commit(set, state, change(structuredClone(state.project)))
  },
  edit: change => {
    if (get().readOnly) return
    get().finishPreview()
    const state = get()
    if (!state.project) return
    const next = structuredClone(state.project)
    const level = activeLevel(next, state.activeLevelId)
    if (level.locked) return
    const before: Model = { walls: level.walls, doors: level.doors, windows: level.windows,
      passages: level.passages || [], rooms: level.rooms, ramps: level.ramps || [],
      seatingSections: level.seatingSections || [], roof: level.roof }
    Object.assign(level, change(before))
    if (level.roof !== before.roof && level.roof) next.buildings[0].roof = level.roof
    if (level.walls !== before.walls) { refreshAutoSlabs(level); repairGeneratedFence(next.buildings[0]) }
    commit(set, state, next)
  },
  undo: () => {
    if (get().readOnly) return
    if (get().previewBase) { get().cancelPreview(); return }
    const state = get()
    if (!state.project || !state.history.length) return
    const project = state.history.at(-1)!
    set({ project, activeLevelId: project.buildings[0].levels.some(level => level.id === state.activeLevelId)
      ? state.activeLevelId : project.buildings[0].levels[0].id,
      history: state.history.slice(0, -1), future: [...state.future, state.project], dirty: true, version: state.version + 1 })
  },
  redo: () => {
    if (get().readOnly) return
    get().cancelPreview()
    const state = get()
    if (!state.project || !state.future.length) return
    const project = state.future.at(-1)!
    set({ project, activeLevelId: project.buildings[0].levels.some(level => level.id === state.activeLevelId)
      ? state.activeLevelId : project.buildings[0].levels[0].id,
      history: [...state.history, state.project], future: state.future.slice(0, -1), dirty: true, version: state.version + 1 })
  },
  markSaved: version => { if (get().version === version) set({ dirty: false }) },
}))
