import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { Level, Point, Selection } from '../../domain/types'
import { uid } from '../../domain/types'
import { atWall, distance, roomArea, wallLength } from '../../geometry/math'
import { constrainPoint } from '../../geometry/snapping'
import { useProject } from '../../state/project'
import { formatArea, formatDistance, type Unit } from '../../geometry/units'
import { zoomEvent, type ZoomDetail } from '../../app/useWorkspaceZoom'
import { WallLayer, type WallDrag } from './WallLayer'
import { PlanSettings } from './PlanSettings'
import { ReviewLayer, type ReviewView } from './ReviewLayer'
import { OpeningLayer } from './OpeningLayer'
import { validateOpening } from '../../geometry/openingValidation'
import type { OpeningCandidate } from '../../geometry/openingCandidates'
type Props = {
  level: Level; selection: Selection; select: (selection: Selection) => void; unit: Unit
  source?: { url: string; x: number; z: number; width: number; height: number }
  review?: { candidates: Level['walls']; openings: OpeningCandidate[]; view: ReviewView; selected: string | null;
    setSelected: (id: string | null) => void; setCandidates: (change: (walls: Level['walls']) => Level['walls']) => void }
}
type Box = { x: number; z: number; width: number; height: number }
function fitBounds(level: Level, source?: Props['source']): Box {
  const points = level.walls.flatMap(wall => [wall.start, wall.end])
  if (source) points.push({ x: source.x, z: source.z }, { x: source.x + source.width, z: source.z + source.height })
  if (!points.length) return { x: -1.5, z: -1.5, width: 15, height: 11 }
  const minX = Math.min(...points.map(p => p.x)), maxX = Math.max(...points.map(p => p.x))
  const minZ = Math.min(...points.map(p => p.z)), maxZ = Math.max(...points.map(p => p.z))
  const width = Math.max(4, maxX - minX), height = Math.max(4, maxZ - minZ)
  return { x: minX - width * .08, z: minZ - height * .08, width: width * 1.16, height: height * 1.16 }
}
export function PlanEditor({ level, selection, select, unit, source, review }: Props) {
  const svg = useRef<SVGSVGElement>(null)
  const [box, setBox] = useState<Box>(() => fitBounds(level, source))
  const [draft, setDraft] = useState<Point[]>([])
  const [cursor, setCursor] = useState<Point | null>(null)
  const [snapGuide, setSnapGuide] = useState<Point | null>(null)
  const [measure, setMeasure] = useState<Point[]>([])
  const [message, setMessage] = useState('')
  const [drag, setDrag] = useState<WallDrag | null>(null)
  const [pan, setPan] = useState<Point | null>(null)
  useEffect(() => {
    const node = svg.current, host = node?.parentElement
    if (!node || !host) return
    const zoom = (event: Event) => {
      const { factor, reset, clientX, clientY } = (event as CustomEvent<ZoomDetail>).detail
      if (reset) { setBox(fitBounds(level, source)); return }
      const bounds = node.getBoundingClientRect()
      const point = node.createSVGPoint()
      point.x = clientX !== undefined && clientX >= bounds.left && clientX <= bounds.right ? clientX : bounds.left + bounds.width / 2
      point.y = clientY !== undefined && clientY >= bounds.top && clientY <= bounds.bottom ? clientY : bounds.top + bounds.height / 2
      const anchor = point.matrixTransform(node.getScreenCTM()!.inverse())
      setBox(current => {
        const scale = Math.max(.25 / current.width, Math.min(2000 / current.width, factor || 1))
        return { x: anchor.x + (current.x - anchor.x) * scale, z: anchor.y + (current.z - anchor.y) * scale,
          width: current.width * scale, height: current.height * scale }
      })
    }
    host.addEventListener(zoomEvent, zoom)
    return () => host.removeEventListener(zoomEvent, zoom)
  }, [level, source])
  const tool = useProject(s => s.tool), edit = useProject(s => s.edit)
  const grid = useProject(s => s.grid), setGrid = useProject(s => s.setGrid)
  const point = (event: { clientX: number; clientY: number }): Point => {
    const local = svg.current!.createSVGPoint()
    local.x = event.clientX; local.y = event.clientY
    const result = local.matrixTransform(svg.current!.getScreenCTM()!.inverse())
    return { x: result.x, z: result.y }
  }
  const snap = (p: Point, start?: Point) => constrainPoint(p, level.walls, box.width * .012, grid, start)
  const nearestWall = (p: Point) => {
    let match: { id: string; offset: number; gap: number } | null = null
    for (const wall of level.walls) {
      const dx = wall.end.x - wall.start.x, dz = wall.end.z - wall.start.z
      if (dx * dx + dz * dz < .0001) continue
      const t = Math.max(0, Math.min(1, ((p.x - wall.start.x) * dx + (p.z - wall.start.z) * dz) / (dx * dx + dz * dz)))
      const q = atWall(wall, t * wallLength(wall)), gap = distance(p, q)
      if (!match || gap < match.gap) match = { id: wall.id, offset: t * wallLength(wall), gap }
    }
    return match && match.gap < .55 ? match : null
  }
  const down = (event: ReactPointerEvent<SVGSVGElement>) => {
    const raw = point(event)
    const p = event.shiftKey ? raw : snap(raw, tool === 'wall' && draft.length ? draft[0] : undefined)
    if (event.button === 1 || tool === 'pan') { setPan(raw); svg.current?.setPointerCapture(event.pointerId); return }
    if (tool === 'wall') {
      if (!draft.length) setDraft([p])
      else if (distance(draft[0], p) > .08) {
        edit(model => ({ ...model, walls: [...model.walls, { id: uid('wall'), start: draft[0], end: p, thickness: .2, height: 2.9, material: 'plaster' }] }))
        setDraft([p])
      }
    }
    if (tool === 'door' || tool === 'window') {
      const host = nearestWall(raw)
      if (!host) { setMessage('Click near a wall to place an opening.'); return }
      const wall = level.walls.find(item => item.id === host.id)!
      const width = tool === 'door' ? .9 : 1.4
      if (wallLength(wall) < width + .1) { setMessage('This wall is too short for the opening.'); return }
      setMessage('')
      const offset = Math.max(.05, Math.min(wallLength(wall) - width - .05, host.offset - width / 2))
      if (tool === 'door') {
        const next = { id: uid('door'), wallId: host.id, offset, width, height: 2.1, hinge: 'left' as const }
        const issue = validateOpening(level, next)
        if (issue) setMessage(issue); else edit(model => ({ ...model, doors: [...model.doors, next] }))
      } else {
        const next = { id: uid('window'), wallId: host.id, offset, width, height: 1.25, sill: .9 }
        const issue = validateOpening(level, next)
        if (issue) setMessage(issue); else edit(model => ({ ...model, windows: [...model.windows, next] }))
      }
    }
    if (tool === 'room') setDraft(points => [...points, p])
    if (tool === 'measure') setMeasure(points => points.length === 1 ? [points[0], p] : [p])
    if (tool === 'select' && !drag) select(null)
  }
  const move = (event: ReactPointerEvent<SVGSVGElement>) => {
    const p = point(event)
    const aligned = event.shiftKey ? p : snap(p, tool === 'wall' && draft.length ? draft[0] : undefined)
    setCursor(aligned)
    setSnapGuide(distance(p, aligned) > .001 ? aligned : null)
    if (pan) { setBox(current => ({ ...current, x: current.x + pan.x - p.x, z: current.z + pan.z - p.z })); return }
    if (drag?.kind === 'end') setDrag({ ...drag, point: snap(p) })
    if (drag?.kind === 'wall') setDrag({ ...drag, delta: { x: p.x - drag.origin.x, z: p.z - drag.origin.z } })
  }
  const finishRoom = () => {
    if (draft.length >= 3) edit(model => ({ ...model, rooms: [...model.rooms, { id: uid('room'), name: `Room ${model.rooms.length + 1}`, polygon: draft, material: 'oak' }] }))
    else setMessage('A room needs at least three points.')
    setDraft([])
  }
  const finishDrag = () => {
    if (drag?.kind === 'end') edit(model => ({ ...model, walls: model.walls.map(wall => wall.id === drag.wallId ? { ...wall, [drag.end]: drag.point } : wall) }))
    if (drag?.kind === 'wall' && Math.hypot(drag.delta.x, drag.delta.z) > .01) edit(model => ({ ...model, walls: model.walls.map(wall => wall.id === drag.wallId ? {
      ...wall, start: { x: drag.start.x + drag.delta.x, z: drag.start.z + drag.delta.z },
      end: { x: drag.end.x + drag.delta.x, z: drag.end.z + drag.delta.z },
    } : wall) }))
    setPan(null); setDrag(null)
  }
  return <section className="plan-editor">
    <div className="viewport-head"><span>GROUND FLOOR · PLAN</span><div>
      <PlanSettings grid={grid} setGrid={setGrid} unit={unit} />
      <button onClick={() => setBox(fitBounds(level, source))}>Fit</button>
      {tool === 'room' && draft.length > 2 && <button onClick={finishRoom}>Close room</button>}
      {draft.length > 0 && <button onClick={() => setDraft([])}>Cancel</button>}
    </div></div>
    <svg ref={svg} className={`plan-svg tool-${tool}${drag || pan ? ' is-dragging' : ''}`} viewBox={`${box.x} ${box.z} ${box.width} ${box.height}`} onPointerDown={down}
      onPointerMove={move} onPointerLeave={() => setSnapGuide(null)} onPointerUp={finishDrag} onDoubleClick={finishRoom}>
      <defs>
        <pattern id="grid-minor" width={grid.step} height={grid.step} patternUnits="userSpaceOnUse"><path d={`M ${grid.step} 0 L 0 0 0 ${grid.step}`} fill="none" stroke="#cbd5ca" strokeWidth=".008" /></pattern>
        <pattern id="grid-major" width="1" height="1" patternUnits="userSpaceOnUse"><path d="M 1 0 L 0 0 0 1" fill="none" stroke="#aebbae" strokeWidth=".018" /></pattern>
      </defs>
      <rect x={-1000} y={-1000} width={2000} height={2000} fill="#f4f5f2" />
      {source && (!review || review.view.source) && <image href={source.url} x={source.x} y={source.z} width={source.width} height={source.height} opacity={review?.view.opacity ?? .6} />}
      {grid.visible && <g opacity={source ? .55 : 1} pointerEvents="none">
        <rect x={-1000} y={-1000} width={2000} height={2000} fill="url(#grid-minor)" />
        <rect x={-1000} y={-1000} width={2000} height={2000} fill="url(#grid-major)" />
      </g>}
      {review && <ReviewLayer svg={svg} {...review} />}
      {level.rooms.map(room => <g key={room.id} className="plan-entity" onPointerDown={event => { if (tool === 'select') { event.stopPropagation(); select({ kind: 'room', id: room.id }) } }}>
        <polygon points={room.polygon.map(p => `${p.x},${p.z}`).join(' ')} fill={selection?.id === room.id ? '#c5ba98' : '#e2dfd4'} fillOpacity={.65} stroke="#bdc1bb" strokeWidth=".02" />
        <text x={room.polygon.reduce((a, p) => a + p.x, 0) / room.polygon.length}
          y={room.polygon.reduce((a, p) => a + p.z, 0) / room.polygon.length}
          textAnchor="middle" className="room-label">{room.name} · {formatArea(roomArea(room), unit)}</text>
      </g>)}
      <WallLayer walls={level.walls} selection={selection} drag={drag} tool={tool} unit={unit}
        onWallDown={(event, wall) => {
          event.stopPropagation(); select({ kind: 'wall', id: wall.id })
          setDrag({ wallId: wall.id, kind: 'wall', origin: point(event), start: wall.start,
            end: wall.end, delta: { x: 0, z: 0 } })
          svg.current?.setPointerCapture(event.pointerId)
        }}
        onEndDown={(event, wall, end) => {
          event.stopPropagation(); setDrag({ wallId: wall.id, kind: 'end', end, point: wall[end] })
          svg.current?.setPointerCapture(event.pointerId)
        }} />
      <OpeningLayer svg={svg} level={level} selection={selection} select={select} tool={tool} />
      {draft.length > 0 && cursor && <polyline points={[...draft, cursor].map(p => `${p.x},${p.z}`).join(' ')} fill="none" stroke="#b28b4a" strokeWidth=".045" strokeDasharray=".14 .09" />}
      {snapGuide && <circle cx={snapGuide.x} cy={snapGuide.z} r=".09" fill="none" stroke="#b28b4a" strokeWidth=".035" pointerEvents="none" />}
      {measure.length === 2 && <g>
        <line x1={measure[0].x} y1={measure[0].z} x2={measure[1].x} y2={measure[1].z}
          stroke="#ad7145" strokeWidth=".035" />
        <text x={(measure[0].x + measure[1].x) / 2} y={(measure[0].z + measure[1].z) / 2 - .12}
          textAnchor="middle" className="measure-label">{formatDistance(distance(measure[0], measure[1]), unit)}</text>
      </g>}
    </svg>
    <div className="viewport-foot">{message || (tool === 'wall' ? 'Click two points to draw · Shift disables snap · Esc cancels'
      : tool === 'room' ? 'Click vertices · Double click or Close room to finish'
        : tool === 'measure' ? 'Click two points to measure'
          : 'Ctrl + scroll zoom · Ctrl + / − zoom · Ctrl + 0 fit · Middle drag pan')}</div>
  </section>
}
