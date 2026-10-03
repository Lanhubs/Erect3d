import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { uid, type Level, type Point, type Ramp, type Selection } from '../../domain/types'
import { distance, nearestWallOffset, wallCurveThroughPoints, wallLength, wallWithEndpoint } from '../../geometry/math'
import { constrainPoint } from '../../geometry/snapping'
import { useProject } from '../../state/project'
import { type Unit } from '../../geometry/units'
import { usePlanZoom } from './usePlanZoom'
import { WallLayer, type WallDrag } from './WallLayer'
import { PlanSettings } from './PlanSettings'
import { ReviewLayer, type ReviewView } from './ReviewLayer'
import { OpeningLayer } from './OpeningLayer'
import { validateOpening } from '../../geometry/openingValidation'
import type { OpeningCandidate } from '../../geometry/openingCandidates'
import { LevelUnderlay } from './LevelUnderlay'
import { SlabLayer } from './SlabLayer'
import { RampLayer } from './RampLayer'
import { SeatingLayer } from './SeatingLayer'
import { PlanRoomLayer } from './PlanRoomLayer'
import { PlanDraftLayer } from './PlanDraftLayer'
import { ArchitecturalDetailLayer } from './ArchitecturalDetailLayer'
import { fitBounds, type PlanBox, type PlanSourceRect } from './planBounds'
type Props = {
  level: Level; selection: Selection; select: (selection: Selection) => void; unit: Unit
  source?: PlanSourceRect; underlay?: Level
  review?: { candidates: Level['walls']; openings: OpeningCandidate[]; view: ReviewView; selected: string | null;
    setSelected: (id: string | null) => void; setCandidates: (change: (walls: Level['walls']) => Level['walls']) => void }
}
export function PlanEditor({ level, selection, select, unit, source, underlay, review }: Props) {
  const svg = useRef<SVGSVGElement>(null)
  const [box, setBox] = useState<PlanBox>(() => fitBounds(level, source))
  const [draft, setDraft] = useState<Point[]>([])
  const [curveDraft, setCurveDraft] = useState<Point[]>([])
  const [rampDraft, setRampDraft] = useState<Point[]>([])
  const [cursor, setCursor] = useState<Point | null>(null)
  const [snapGuide, setSnapGuide] = useState<Point | null>(null)
  const [measure, setMeasure] = useState<Point[]>([])
  const [message, setMessage] = useState('')
  const [drag, setDrag] = useState<WallDrag | null>(null)
  const [pan, setPan] = useState<Point | null>(null)
  usePlanZoom(svg, level, source, setBox)
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
      const closest = nearestWallOffset(wall, p)
      if (!match || closest.distance < match.gap) match = { id: wall.id, offset: closest.offset, gap: closest.distance }
    }
    return match && match.gap < .55 ? match : null
  }
  const down = (event: ReactPointerEvent<SVGSVGElement>) => {
    const raw = point(event)
    const p = event.shiftKey ? raw : snap(raw, tool === 'wall' && draft.length ? draft[0]
      : tool === 'curve' && curveDraft.length ? curveDraft[0] : tool === 'ramp' && rampDraft.length ? rampDraft[0] : undefined)
    if (event.button === 1 || tool === 'pan') { setPan(raw); svg.current?.setPointerCapture(event.pointerId); return }
    if (tool === 'wall') {
      if (!draft.length) setDraft([p])
      else if (distance(draft[0], p) > .08) {
        const next = { id: uid('wall'), start: draft[0], end: p, thickness: .2,
          height: Math.max(2.2, (level.floorToFloorHeight || 3.1) - level.slabThickness), material: 'plaster' as const }
        if (review) review.setCandidates(items => [...items, next])
        else edit(model => ({ ...model, walls: [...model.walls, next] }))
        setDraft([p])
      }
    }
    if (tool === 'curve') {
      if (curveDraft.length < 2) setCurveDraft(points => [...points, p])
      else {
        const [start, through] = curveDraft
        const curve = wallCurveThroughPoints(start, through, p)
        if (!curve) setMessage('Choose three non-collinear points for the curve.')
        else {
          const next = { id: uid('wall'), start, end: p, curve, thickness: .2,
            height: Math.max(2.2, (level.floorToFloorHeight || 3.1) - level.slabThickness), material: 'plaster' as const }
          edit(model => ({ ...model, walls: [...model.walls, next] }))
          setMessage(''); setCurveDraft([])
        }
      }
    }
    if (tool === 'ramp') {
      if (!rampDraft.length) setRampDraft([p])
      else if (distance(rampDraft[0], p) > .3) {
        const next: Ramp = { id: uid('ramp'), start: rampDraft[0], end: p, width: 1.2, thickness: .15,
          startElevation: 0, endElevation: .45, material: 'reinforced-concrete' }
        edit(model => ({ ...model, ramps: [...model.ramps, next] }))
        setRampDraft([])
      }
    }
    if (tool === 'door' || tool === 'window') {
      if (review) { setMessage('Classify detected gaps in Openings, or place new openings after accepting the walls.'); return }
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
    const aligned = event.shiftKey ? p : snap(p, tool === 'wall' && draft.length ? draft[0]
      : tool === 'curve' && curveDraft.length ? curveDraft[0] : tool === 'ramp' && rampDraft.length ? rampDraft[0] : undefined)
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
    if (drag?.kind === 'end') {
      const wall = level.walls.find(item => item.id === drag.wallId)
      const proposed = wall && wallWithEndpoint(wall, drag.end, drag.point)
      const required = Math.max(.1, ...[...level.doors, ...level.windows, ...(level.passages || [])]
        .filter(item => item.wallId === drag.wallId).map(item => item.offset + item.width + .05))
      if (proposed && wallLength(proposed) < required) setMessage('This wall would become too short for its openings.')
      else if (proposed) edit(model => ({ ...model, walls: model.walls.map(item => item.id === drag.wallId ? proposed : item) }))
    }
    if (drag?.kind === 'wall' && Math.hypot(drag.delta.x, drag.delta.z) > .01) edit(model => ({ ...model, walls: model.walls.map(wall => wall.id === drag.wallId ? {
      ...wall, start: { x: drag.start.x + drag.delta.x, z: drag.start.z + drag.delta.z },
      end: { x: drag.end.x + drag.delta.x, z: drag.end.z + drag.delta.z },
      ...(wall.curve ? { curve: { ...wall.curve, center: { x: wall.curve.center.x + drag.delta.x, z: wall.curve.center.z + drag.delta.z } } } : {}),
    } : wall) }))
    setPan(null); setDrag(null)
  }
  return <section className="plan-editor">
    <div className="viewport-head"><span>{level.name.toUpperCase()} · PLAN</span><div>
      <PlanSettings grid={grid} setGrid={setGrid} unit={unit} />
      <button onClick={() => setBox(fitBounds(level, source))}>Fit</button>
      {tool === 'room' && draft.length > 2 && <button onClick={finishRoom}>Close room</button>}
      {(draft.length > 0 || curveDraft.length > 0 || rampDraft.length > 0) &&
        <button onClick={() => { setDraft([]); setCurveDraft([]); setRampDraft([]) }}>Cancel</button>}
    </div></div>
    <svg ref={svg} className={`plan-svg tool-${tool}${drag || pan ? ' is-dragging' : ''}`} viewBox={`${box.x} ${box.z} ${box.width} ${box.height}`} onPointerDown={down}
      onPointerMove={move} onPointerLeave={() => setSnapGuide(null)} onPointerUp={finishDrag} onDoubleClick={finishRoom}>
      <defs>
        <pattern id="grid-minor" width={grid.step} height={grid.step} patternUnits="userSpaceOnUse"><path d={`M ${grid.step} 0 L 0 0 0 ${grid.step}`} fill="none" stroke="#cbd5ca" strokeWidth=".008" /></pattern>
        <pattern id="grid-major" width="1" height="1" patternUnits="userSpaceOnUse"><path d="M 1 0 L 0 0 0 1" fill="none" stroke="#aebbae" strokeWidth=".018" /></pattern>
      </defs>
      <rect x={-1000} y={-1000} width={2000} height={2000} fill="#f4f5f2" />
      {underlay && <LevelUnderlay level={underlay} />}
      {source && (!review || review.view.source) && <image href={source.url} x={source.x} y={source.z} width={source.width} height={source.height} opacity={review?.view.opacity ?? .6} />}
      {!review && <SlabLayer slabs={level.slabs || []} />}
      {grid.visible && <g opacity={source ? .55 : 1} pointerEvents="none">
        <rect x={-1000} y={-1000} width={2000} height={2000} fill="url(#grid-minor)" />
        <rect x={-1000} y={-1000} width={2000} height={2000} fill="url(#grid-major)" />
      </g>}
      {review && <ReviewLayer svg={svg} {...review} />}
      {!review && <PlanRoomLayer rooms={level.rooms} selection={selection} select={select} tool={tool} unit={unit} />}
      {!review && <WallLayer walls={level.walls} selection={selection} drag={drag} tool={tool} unit={unit}
        onWallDown={(event, wall) => {
          event.stopPropagation(); select({ kind: 'wall', id: wall.id })
          setDrag({ wallId: wall.id, kind: 'wall', origin: point(event), start: wall.start,
            end: wall.end, delta: { x: 0, z: 0 } })
          svg.current?.setPointerCapture(event.pointerId)
        }}
        onEndDown={(event, wall, end) => {
          event.stopPropagation(); setDrag({ wallId: wall.id, kind: 'end', end, point: wall[end] })
          svg.current?.setPointerCapture(event.pointerId)
        }} />}
      {!review && <RampLayer ramps={level.ramps || []} selection={selection} select={select} tool={tool} />}
      {!review && <SeatingLayer sections={level.seatingSections || []} selection={selection} select={select} tool={tool} />}
      {!review && <ArchitecturalDetailLayer details={level.details || []} selection={selection} select={select} tool={tool} />}
      {!review && <OpeningLayer svg={svg} level={level} selection={selection} select={select} tool={tool} />}
      <PlanDraftLayer tool={tool} draft={draft} curveDraft={curveDraft} rampDraft={rampDraft}
        cursor={cursor} snapGuide={snapGuide} measure={measure} unit={unit} />
    </svg>
    <div className="viewport-foot">{message || (tool === 'wall' ? 'Click two points to draw · Shift disables snap · Esc cancels'
      : tool === 'curve' ? `Click start, bulge, end · ${curveDraft.length}/2 points · Esc cancels`
        : tool === 'ramp' ? 'Click ramp start and end · Esc cancels'
      : tool === 'room' ? 'Click vertices · Double click or Close room to finish'
        : tool === 'measure' ? 'Click two points to measure'
          : 'Ctrl + scroll zoom · Ctrl + / − zoom · Ctrl + 0 fit · Middle drag pan')}</div>
  </section>
}
