import { useEffect, useRef } from 'react'
import type { Level, Selection } from '../domain/types'
import { useProject } from '../state/project'
import { bindDragBoundary } from '../features/editing/dragBoundary'
import { furnitureFootprint } from './entities'
import { furnitureLabel } from './types'
import { useFurnitureReview } from './reviewState'
import { pointerPlanPoint } from '../features/plan/planBounds'
import { useElementEditing } from '../features/editing/useElementEditing'
export function FurnitureLayer({
  level,
  selection,
  select,
}: {
  level: Level
  selection: Selection
  select: (selection: Selection) => void
}) {
  const { shown, key, candidates, patch, selected, select: selectProposal } = useFurnitureReview()
  const tool = useProject((state) => state.tool),
    editing = useElementEditing(tool === 'select' && !level.locked)
  const cleanup = useRef<(() => void) | null>(null)
  useEffect(() => () => cleanup.current?.(), [])
  if (!shown) return null
  const proposals = key === `${level.id}:${level.sourceId || ''}` ? candidates : []
  return (
    <g className="furniture-plan-layer">
      {(level.furniture || []).map((object) => (
        <g
          key={object.id}
          transform={`translate(${object.position.x},${object.position.z}) rotate(${object.rotation})`}
          style={{ cursor: tool === 'select' ? 'grab' : undefined }}
          onPointerDown={(event) => {
            if (tool !== 'select') return
            event.stopPropagation()
            select({ kind: 'furniture', id: object.id })
            if (level.locked) return
            const svg = event.currentTarget.ownerSVGElement!,
              matrix = svg.getScreenCTM()!.inverse()
            editing.start('move', pointerPlanPoint(svg, event, matrix))
            svg.setPointerCapture(event.pointerId)
            const move = (e: PointerEvent) => editing.move(pointerPlanPoint(svg, e, matrix), e.shiftKey)
            const finish = () => {
                release()
                editing.finish()
              },
              cancel = () => {
                release()
                editing.cancel()
              }
            const escape = (e: KeyboardEvent) => {
              if (e.key === 'Escape') cancel()
            }
            let releaseBoundary = () => {}
            const release = () => {
              releaseBoundary()
              window.removeEventListener('pointermove', move)
              window.removeEventListener('pointerup', finish)
              window.removeEventListener('pointercancel', cancel)
              window.removeEventListener('keydown', escape)
            }
            releaseBoundary = bindDragBoundary(svg, event.pointerId, finish, cancel)
            editing.setCleanup(release)
            window.addEventListener('pointermove', move)
            window.addEventListener('pointerup', finish, { once: true })
            window.addEventListener('pointercancel', cancel, { once: true })
            window.addEventListener('keydown', escape)
          }}
        >
          <title>{`${furnitureLabel(object.type)} · drag to move`}</title>
          <rect
            x={-object.width / 2}
            y={-object.depth / 2}
            width={object.width}
            height={object.depth}
            rx=".05"
            fill={object.materialOverrides?.color || '#ddd2be'}
            stroke={selection?.id === object.id ? '#2176b0' : '#78766d'}
            strokeWidth={selection?.id === object.id ? '.05' : '.025'}
          />
          {object.type === 'bed' ? (
            <>
              <rect
                x={-object.width * 0.43}
                y={-object.depth * 0.42}
                width={object.width * 0.86}
                height={object.depth * 0.2}
                rx=".08"
                fill="#f5f1e8"
                stroke="#99978d"
                strokeWidth=".02"
              />
              <path
                d={`M${-object.width / 2},${-object.depth * 0.12}H${object.width / 2}`}
                stroke="#99978d"
                strokeWidth=".025"
              />
            </>
          ) : object.type === 'sofa' ? (
            <rect
              x={-object.width * 0.36}
              y={-object.depth * 0.16}
              width={object.width * 0.72}
              height={object.depth * 0.58}
              rx=".05"
              fill="#ece5d8"
              stroke="#88887b"
              strokeWidth=".02"
            />
          ) : (
            <text
              textAnchor="middle"
              y=".06"
              fontSize={Math.min(0.18, object.width / 7)}
              fill="#596254"
              pointerEvents="none"
            >
              {furnitureLabel(object.type)}
            </text>
          )}
        </g>
      ))}
      {proposals.map((object) => (
        <polygon
          key={object.id}
          points={furnitureFootprint(object)
            .map((p) => `${p.x},${p.z}`)
            .join(' ')}
          fill={
            object.status === 'accepted'
              ? '#40856033'
              : object.status === 'rejected'
                ? '#a9585833'
                : '#c3943433'
          }
          stroke={
            object.status === 'accepted' ? '#387855' : object.status === 'rejected' ? '#a95858' : '#b08222'
          }
          strokeWidth={selected === object.id ? '.07' : '.03'}
          strokeDasharray={object.status === 'uncertain' ? '.12 .08' : undefined}
          style={{ cursor: 'grab' }}
          onPointerDown={(event) => {
            event.preventDefault()
            event.stopPropagation()
            selectProposal(object.id)
            cleanup.current?.()
            const svg = event.currentTarget.ownerSVGElement!,
              matrix = svg.getScreenCTM()!.inverse(),
              start = pointerPlanPoint(svg, event, matrix)
            const move = (e: PointerEvent) => {
              const point = pointerPlanPoint(svg, e, matrix)
              patch(object.id, {
                position: {
                  x: object.position.x + point.x - start.x,
                  z: object.position.z + point.z - start.z,
                },
                status: 'uncertain',
              })
            }
            let releaseBoundary = () => {}
            const release = () => {
              releaseBoundary()
              window.removeEventListener('pointermove', move)
              window.removeEventListener('pointerup', release)
              window.removeEventListener('pointercancel', release)
              cleanup.current = null
            }
            releaseBoundary = bindDragBoundary(svg, event.pointerId, release, release)
            cleanup.current = release
            svg.setPointerCapture(event.pointerId)
            window.addEventListener('pointermove', move)
            window.addEventListener('pointerup', release, { once: true })
            window.addEventListener('pointercancel', release, { once: true })
          }}
        >
          <title>{`${furnitureLabel(object.type)} · ${Math.round(object.confidence * 100)}% · ${object.status}`}</title>
        </polygon>
      ))}
    </g>
  )
}
