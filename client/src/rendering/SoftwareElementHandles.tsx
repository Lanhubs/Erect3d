import type { RefObject } from 'react'
import type { Level, Point } from '../domain/types'
import { selectedElement, pointsCenter, canRotate, canAdjustHeight } from '../domain/elementGeometry'
import { useProject } from '../state/project'
import { useElementEditing, type EditHandle } from '../features/editing/useElementEditing'
import { projectSoftware, unprojectSoftware } from './softwareProjection'

export function SoftwareElementHandles({
  svg,
  level,
  top,
  size,
}: {
  svg: RefObject<SVGSVGElement | null>
  level: Level
  top: boolean
  size: number
}) {
  const state = useProject(),
    editing = useElementEditing()
  const target = state.project && selectedElement(state.project.buildings[0], state.selection)
  if (!target || target.level.id !== level.id || level.locked || state.tool !== 'select') return null
  const center = pointsCenter(target.points),
    height = target.height,
    reach = Math.max(0.55, size * 0.035),
    radius = size * 0.009
  const handle = (key: EditHandle, p: Point, color: string, label: string) => {
    const [x, y] = projectSoftware([p.x, height, p.z], top)
    return (
      <g
        key={key}
        className="element-handle"
        onPointerDown={(event) => {
          event.stopPropagation()
          event.preventDefault()
          const canvas = svg.current!,
            matrix = canvas.getScreenCTM()!.inverse()
          const point = (next: { clientX: number; clientY: number }) => {
            const screen = canvas.createSVGPoint()
            screen.x = next.clientX
            screen.y = next.clientY
            const local = screen.matrixTransform(matrix)
            return unprojectSoftware(local.x, local.y, height, top)
          }
          editing.start(key, point(event))
          canvas.setPointerCapture(event.pointerId)
          const move = (next: PointerEvent) =>
            editing.move(point(next), next.shiftKey, (event.clientY - next.clientY) * 0.01)
          const cleanup = () => {
            window.removeEventListener('pointermove', move)
            window.removeEventListener('pointerup', finish)
            window.removeEventListener('pointercancel', cancel)
            window.removeEventListener('keydown', keydown)
          }
          const finish = () => {
              cleanup()
              editing.finish()
            },
            cancel = () => {
              cleanup()
              editing.cancel()
            }
          const keydown = (next: KeyboardEvent) => {
            if (next.key === 'Escape') cancel()
          }
          editing.setCleanup(cleanup)
          window.addEventListener('pointermove', move)
          window.addEventListener('pointerup', finish, { once: true })
          window.addEventListener('pointercancel', cancel, { once: true })
          window.addEventListener('keydown', keydown)
        }}
      >
        <title>{label}</title>
        <circle cx={x} cy={y} r={radius} fill={color} stroke="white" strokeWidth={radius * 0.2} />
        {typeof key !== 'number' && (
          <text
            x={x}
            y={y + radius * 0.4}
            textAnchor="middle"
            fill="white"
            fontSize={radius * 1.4}
            pointerEvents="none"
          >
            {key === 'move' ? '↔' : key === 'rotate' ? '↻' : key === 'scale' ? '↗' : '↑'}
          </text>
        )}
      </g>
    )
  }
  return (
    <g>
      {!['column', 'stair'].includes(state.selection!.kind) &&
        target.points.map((p, i) => handle(i, p, '#2477ae', 'Drag to reshape'))}
      {handle('move', center, '#2477ae', 'Drag to move')}
      {canRotate(state.selection) &&
        handle('rotate', { x: center.x, z: center.z - reach }, '#80639e', 'Drag to rotate')}
      {handle('scale', { x: center.x + reach, z: center.z }, '#488363', 'Drag to resize')}
      {canAdjustHeight(state.selection) &&
        handle('height', { x: center.x - reach, z: center.z }, '#b27837', 'Drag to adjust height')}
      {editing.message && (
        <text
          x={projectSoftware([center.x, height, center.z], top)[0]}
          y={projectSoftware([center.x, height, center.z], top)[1] + reach}
          fontSize={radius}
          fill="#9a3d24"
          textAnchor="middle"
        >
          {editing.message}
        </text>
      )}
    </g>
  )
}
