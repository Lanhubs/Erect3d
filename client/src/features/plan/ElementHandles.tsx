import type { RefObject } from 'react'
import type { Level, Point } from '../../domain/types'
import { selectedElement, pointsCenter, canRotate, canAdjustHeight } from '../../domain/elementGeometry'
import { useProject } from '../../state/project'
import { useElementEditing, type EditHandle } from '../editing/useElementEditing'
import { pointerPlanPoint } from './planBounds'
import { bindDragBoundary } from '../editing/dragBoundary'

export function ElementHandles({
  svg,
  level,
  size,
}: {
  svg: RefObject<SVGSVGElement | null>
  level: Level
  size: number
}) {
  const state = useProject(),
    editing = useElementEditing(state.tool === 'select')
  const target = state.project && selectedElement(state.project.buildings[0], state.selection)
  if (
    !target ||
    target.level.id !== level.id ||
    level.locked ||
    state.tool !== 'select' ||
    !target.points.length
  )
    return null
  const center = pointsCenter(target.points),
    radius = size * 0.008,
    reach = Math.max(size * 0.055, 0.35)
  const handle = (key: EditHandle, point: Point, label: string, color = '#2477ae') => (
    <g
      key={String(key)}
      className="element-handle"
      onPointerDown={(event) => {
        event.preventDefault()
        event.stopPropagation()
        svg.current?.focus()
        const canvas = svg.current!
        const matrix = canvas.getScreenCTM()!.inverse()
        editing.start(key, pointerPlanPoint(canvas, event, matrix))
        canvas.setPointerCapture(event.pointerId)
        const move = (next: PointerEvent) =>
          editing.move(pointerPlanPoint(canvas, next, matrix), next.shiftKey)
        const finish = () => {
          cleanup()
          editing.finish()
        }
        const cancel = () => {
          cleanup()
          editing.cancel()
        }
        const keydown = (next: KeyboardEvent) => {
          if (next.key === 'Escape') cancel()
        }
        let releaseBoundary = () => {}
        const cleanup = () => {
          releaseBoundary()
          window.removeEventListener('pointermove', move)
          window.removeEventListener('pointerup', finish)
          window.removeEventListener('pointercancel', cancel)
          window.removeEventListener('keydown', keydown)
        }
        releaseBoundary = bindDragBoundary(canvas, event.pointerId, finish, cancel)
        editing.setCleanup(cleanup)
        window.addEventListener('pointermove', move)
        window.addEventListener('pointerup', finish, { once: true })
        window.addEventListener('pointercancel', cancel, { once: true })
        window.addEventListener('keydown', keydown)
      }}
    >
      <title>{label}</title>
      <circle
        cx={point.x}
        cy={point.z}
        r={radius * 1.7}
        fill={color}
        stroke="#fff"
        strokeWidth={radius * 0.35}
      />
      {typeof key !== 'number' && (
        <text
          x={point.x}
          y={point.z + radius * 0.6}
          textAnchor="middle"
          fontSize={radius * 2.3}
          fill="white"
          pointerEvents="none"
        >
          {key === 'move' ? '↔' : key === 'rotate' ? '↻' : key === 'scale' ? '↗' : '↑'}
        </text>
      )}
    </g>
  )
  return (
    <g className="element-edit-handles">
      {state.selection?.kind !== 'column' &&
        state.selection?.kind !== 'stair' &&
        target.points.map((point, index) => handle(index, point, `Reshape vertex ${index + 1}`))}
      {handle('move', center, 'Drag to move')}
      {canRotate(state.selection) &&
        handle('rotate', { x: center.x, z: center.z - reach }, 'Drag to rotate', '#80639e')}
      {handle('scale', { x: center.x + reach, z: center.z }, 'Drag to resize', '#488363')}
      {canAdjustHeight(state.selection) &&
        handle('height', { x: center.x - reach, z: center.z }, 'Drag to adjust height', '#b27837')}
      {editing.message && (
        <text x={center.x} y={center.z + reach} fontSize={radius * 2} textAnchor="middle" fill="#9a3d24">
          {editing.message}
        </text>
      )}
    </g>
  )
}
