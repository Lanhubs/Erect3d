import { useEffect, useMemo, useRef, useState } from 'react'
import type { Calibration, Level, Point, SourceDocument, Wall, Selection } from '../domain/types'
import { useProject } from '../state/project'
import { acceptFurniture } from './acceptance'
import { newFurniture } from './entities'
import { furnitureLabel, furnitureTypes, type FurnitureType } from './types'
import { furnitureSourceKey, useFurnitureAnalysis } from './useFurnitureAnalysis'
import { useFurnitureReview } from './reviewState'
import { FurnitureReview } from './FurnitureReview'
import './furniture.css'
export function FurniturePanel({
  level,
  levels,
  source,
  url,
  calibration,
  walls,
  rooms,
  completed,
  select,
  embedded = false,
}: {
  level: Level
  levels: Level[]
  source?: SourceDocument
  url?: string
  calibration?: Calibration
  walls: Wall[]
  rooms: Point[][]
  completed: boolean
  select: (selection: Selection) => void
  embedded?: boolean
}) {
  const [detect, setDetect] = useState(false),
    [type, setType] = useState<FurnitureType>('bed')
  const editProject = useProject((state) => state.editProject)
  const { candidates, key, shown, toggle, clear } = useFurnitureReview()
  const draft = useMemo(
    () =>
      completed && walls.length
        ? {
            ...level,
            walls: walls.map((wall) => ({
              ...wall,
              start: {
                x: wall.start.x + (level.alignment?.x || 0),
                z: wall.start.z + (level.alignment?.z || 0),
              },
              end: { x: wall.end.x + (level.alignment?.x || 0), z: wall.end.z + (level.alignment?.z || 0) },
            })),
            rooms: rooms.map((polygon, i) => ({
              id: `review-room:${i}`,
              name: `Space ${i + 1}`,
              material: 'tile' as const,
              polygon: polygon.map((p) => ({
                x: p.x + (level.alignment?.x || 0),
                z: p.z + (level.alignment?.z || 0),
              })),
            })),
          }
        : level,
    [completed, walls, rooms, level],
  )
  const analysis = useFurnitureAnalysis(draft, levels, source, url, calibration),
    started = useRef('')
  useEffect(() => {
    const signature = `${furnitureSourceKey(level, source)}:${walls.map((wall) => wall.id).join(',')}`
    if (detect && completed && walls.length && started.current !== signature && !analysis.busy) {
      started.current = signature
      void analysis.analyze()
    }
  }, [detect, completed, walls, source, level, analysis])
  const current = key === furnitureSourceKey(level, source) ? candidates : []
  const add = () => {
    const room = level.rooms.find((item) => item.id === useProject.getState().selection?.id) || level.rooms[0]
    const points = room?.polygon || level.slabs?.[0]?.polygon || []
    const position = points.length
      ? {
          x: points.reduce((s, p) => s + p.x, 0) / points.length,
          z: points.reduce((s, p) => s + p.z, 0) / points.length,
        }
      : { x: 0, z: 0 }
    const object = newFurniture(level, type, position)
    editProject((project) => {
      const owner = project.buildings[0].levels.find((item) => item.id === level.id)!
      owner.furniture ||= []
      owner.furniture.push(object)
      return project
    })
    useProject.getState().setTool('select')
    select({ kind: 'furniture', id: object.id })
  }
  return (
    <details open={embedded || undefined} className="furniture-panel">
      <summary>Furniture & fixtures · {level.furniture?.length || 0} objects · optional</summary>
      <div className="furniture-tools">
        <label>
          <input
            type="checkbox"
            checked={detect}
            onChange={(event) => {
              setDetect(event.target.checked)
              if (!event.target.checked) {
                analysis.cancel()
                clear()
                started.current = ''
              }
            }}
          />{' '}
          Interpret furniture with plan analysis
        </label>
        <button
          disabled={analysis.busy || !source || !calibration || level.locked}
          onClick={() => void analysis.analyze()}
        >
          {analysis.busy ? 'Analyzing…' : 'Analyze furniture from source'}
        </button>
        <button aria-pressed={shown} onClick={toggle}>
          Furniture {shown ? 'on' : 'off'}
        </button>
        <select
          aria-label="Furniture to place"
          value={type}
          onChange={(event) => setType(event.target.value as FurnitureType)}
        >
          {furnitureTypes.map((type) => (
            <option key={type} value={type}>
              {furnitureLabel(type)}
            </option>
          ))}
        </select>
        <button disabled={level.locked} onClick={add}>
          Place furniture
        </button>
      </div>
      {analysis.message && <p role="status">{analysis.message}</p>}
      {current.length > 0 && (
        <>
          <FurnitureReview level={draft} levels={levels} />
          <button
            disabled={level.locked || !level.walls.length || !current.some((c) => c.status === 'accepted')}
            onClick={() => {
              editProject((project) => {
                const building = project.buildings[0]
                acceptFurniture(
                  building.levels.find((item) => item.id === level.id)!,
                  current,
                  building.levels,
                )
                return project
              })
              useFurnitureReview.getState().consumeAccepted()
            }}
          >
            Place accepted furniture
          </button>
          <button onClick={clear}>Discard proposals</button>
          <small>
            Accepted proposals also join the next Generate 3D action. Drag overlays to correct position.
          </small>
        </>
      )}
    </details>
  )
}
