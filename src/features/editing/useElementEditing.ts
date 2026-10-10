import { useEffect, useRef, useState } from 'react'
import type { Point, Project, Selection } from '../../domain/types'
import { pointsCenter, selectedElement, type ElementChange } from '../../domain/elementGeometry'
import { transformElement } from '../../domain/elementEditing'
import { useProject } from '../../state/project'
import { editingKey } from './editingKeyboard'
import { constrainPoint } from '../../geometry/snapping'

export type EditHandle = 'move' | 'rotate' | 'scale' | 'height' | number
export function useElementEditing(enabled = true) {
  const [message, setMessage] = useState('')
  const drag = useRef<{ project: Project; selection: Selection; origin: Point; anchor: Point; center: Point; handle: EditHandle } | null>(null)
  const cleanupRef = useRef<(() => void) | null>(null)
  const release = () => { cleanupRef.current?.(); cleanupRef.current = null }
  const apply = (base: Project, selection: Selection, change: ElementChange, preview: boolean) => {
    const result = transformElement(base, selection, change)
    setMessage(result.issue || '')
    if (!result.issue && result.project !== base) {
      const state = useProject.getState()
      if (preview) state.preview(result.project); else state.editProject(() => result.project)
    }
  }
  const start = (handle: EditHandle, origin: Point) => {
    const state = useProject.getState(), target = state.project && selectedElement(state.project.buildings[0], state.selection)
    if (!enabled || !state.project || !target || target.level.locked) { setMessage('Unlock and select an element to edit it.'); return }
    drag.current = { project: state.project, selection: state.selection, origin, anchor: typeof handle === 'number' ? target.points[handle] : origin, center: pointsCenter(target.points), handle }
  }
  const move = (point: Point, fine = false, vertical?: number) => {
    const current = drag.current
    if (!current) return
    const { project, selection, origin, center, handle } = current
    if (fine) { point = { x: origin.x + (point.x - origin.x) * .1, z: origin.z + (point.z - origin.z) * .1 }; if (vertical !== undefined) vertical *= .1 }
    const grid = useProject.getState().grid
    const snap = (v: number) => grid.snap && !fine ? Math.round(v / grid.step) * grid.step : v
    let next = { x: snap(current.anchor.x + point.x - origin.x), z: snap(current.anchor.z + point.z - origin.z) }
    if (typeof handle === 'number' && !fine) next = constrainPoint(next, selectedElement(project.buildings[0], selection)!.level.walls.filter(wall => wall.id !== selection?.id), .12, grid)
    const change: ElementChange = typeof handle === 'number' ? { vertex: { index: handle, point: next } }
      : handle === 'move' ? { move: { x: snap(point.x - origin.x), z: snap(point.z - origin.z) } }
        : handle === 'rotate' ? { rotate: (Math.atan2(point.z - center.z, point.x - center.x) - Math.atan2(origin.z - center.z, origin.x - center.x)) * 180 / Math.PI }
          : handle === 'height' ? { height: vertical ?? origin.z - point.z }
            : { scale: Math.max(.05, Math.hypot(point.x - center.x, point.z - center.z) / Math.max(.01, Math.hypot(origin.x - center.x, origin.z - center.z))) }
    apply(project, selection, change, true)
  }
  const finish = () => { release(); drag.current = null; useProject.getState().finishPreview() }
  const cancel = () => { release(); drag.current = null; useProject.getState().cancelPreview(); setMessage('Edit cancelled.') }
  useEffect(() => () => { cleanupRef.current?.(); if (drag.current) useProject.getState().cancelPreview() }, [])
  const keyboard = (event: React.KeyboardEvent) => {
    if (!enabled || (event.target instanceof HTMLElement && event.target.closest('input,select,textarea,button,[contenteditable=true]'))) return
    if (event.key === 'Escape') { cancel(); return }
    if (event.ctrlKey || event.metaKey || event.altKey) return
    const state = useProject.getState()
    if (!state.project || !state.selection) return
    const change = editingKey(event)
    if (change) { event.preventDefault(); event.stopPropagation(); apply(state.project, state.selection, change, false) }
  }
  return { start, move, finish, cancel, keyboard, message, setCleanup: (cleanup: () => void) => { cleanupRef.current = cleanup } }
}
