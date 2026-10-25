import { SystemsLayer } from './SystemsLayer'
import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { uid, type Level, type Point, type Ramp, type Selection, type SiteFence } from '../../domain/types'
import { distance, nearestWallOffset, wallCurveThroughPoints, wallLength } from '../../geometry/math'
import { constrainPoint } from '../../geometry/snapping'
import { useProject } from '../../state/project'
import { type Unit } from '../../geometry/units'
import { usePlanZoom } from './usePlanZoom'
import { WallLayer } from './WallLayer'
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
import { InterpretationLayer } from './InterpretationLayer'
import type { PlanDetail } from '../../domain/interpretationTypes'
import { fitBounds, pointerPlanPoint, type PlanBox, type PlanSourceRect } from './planBounds'
import { FencePlanLayer } from './FencePlanLayer'
import { ElementHandles } from './ElementHandles'
import { StructureEditLayer } from './StructureEditLayer'
import { useElementEditing } from '../editing/useElementEditing'
import { FurnitureLayer } from '../../furniture/FurnitureLayer'
import { bindDragBoundary } from '../editing/dragBoundary'
type Props = {
  level: Level
  selection: Selection
  select: (selection: Selection) => void
  unit: Unit
  source?: PlanSourceRect
  underlay?: Level
  fence?: SiteFence
  previewOnly?: boolean
  review?: {
    candidates: Level['walls']
    openings: OpeningCandidate[]
    view: ReviewView
    selected: string | null
    setSelected: (id: string | null) => void
    setCandidates: (change: (walls: Level['walls']) => Level['walls']) => void
    rooms?: Point[][]
    spaceChoices?: Record<string, boolean>
    selectedSpace?: string | null
    selectSpace?: (key: string) => void
    details?: PlanDetail[]
    detailChoices?: Record<string, boolean>
  }
}
export function PlanEditor({
  level,
  selection,
  select,
  unit,
  source,
  underlay,
  review,
  fence,
  previewOnly = false,
}: Props) {
  const svg = useRef<SVGSVGElement>(null)
  const dragMatrix = useRef<DOMMatrix | null>(null)
  const [box, setBox] = useState<PlanBox>(() => fitBounds(level, source, fence))
  const [draft, setDraft] = useState<Point[]>([])
  const [curveDraft, setCurveDraft] = useState<Point[]>([])
  const [rampDraft, setRampDraft] = useState<Point[]>([])
  const [cursor, setCursor] = useState<Point | null>(null)
  const [snapGuide, setSnapGuide] = useState<Point | null>(null)
  const [measure, setMeasure] = useState<Point[]>([]),
    [message, setMessage] = useState('')
  const [pan, setPan] = useState<Point | null>(null)
  usePlanZoom(svg, level, source, setBox, fence)
  const tool = useProject((s) => s.tool),
    edit = useProject((s) => s.edit)
  const editing = useElementEditing(!previewOnly && !review && tool === 'select')
  const grid = useProject((s) => s.grid),
    setGrid = useProject((s) => s.setGrid)
  const point = (event: { clientX: number; clientY: number }) =>
    pointerPlanPoint(svg.current!, event, dragMatrix.current)
  const snap = (p: Point, start?: Point) => constrainPoint(p, level.walls, box.width * 0.012, grid, start)
  const nearestWall = (p: Point) => {
    let match: { id: string; offset: number; gap: number } | null = null
    for (const wall of level.walls) {
      const closest = nearestWallOffset(wall, p)
      if (!match || closest.distance < match.gap)
        match = { id: wall.id, offset: closest.offset, gap: closest.distance }
    }
    return match && match.gap < 0.55 ? match : null
  }
  const down = (event: ReactPointerEvent<SVGSVGElement>) => {
    const raw = point(event)
    const p = event.shiftKey
      ? raw
      : snap(
          raw,
          tool === 'wall' && draft.length
            ? draft[0]
            : tool === 'curve' && curveDraft.length
              ? curveDraft[0]
              : tool === 'ramp' && rampDraft.length
                ? rampDraft[0]
                : undefined,
        )
    if (event.button === 1 || tool === 'pan') {
      setPan(raw)
      captureDrag(event.pointerId)
      return
    }
    if (previewOnly) return
    if (tool === 'wall') {
      if (!draft.length) setDraft([p])
      else if (distance(draft[0], p) > 0.08) {
        const next = {
          id: uid('wall'),
          start: draft[0],
          end: p,
          thickness: 0.2,
          height: Math.max(2.2, (level.floorToFloorHeight || 3.1) - level.slabThickness),
          material: 'plaster' as const,
        }
        if (review) review.setCandidates((items) => [...items, next])
        else edit((model) => ({ ...model, walls: [...model.walls, next] }))
        setDraft([p])
      }
    }
    if (tool === 'curve') {
      if (curveDraft.length < 2) setCurveDraft((points) => [...points, p])
      else {
        const [start, through] = curveDraft
        const curve = wallCurveThroughPoints(start, through, p)
        if (!curve) setMessage('Choose three non-collinear points for the curve.')
        else {
          const next = {
            id: uid('wall'),
            start,
            end: p,
            curve,
            thickness: 0.2,
            height: Math.max(2.2, (level.floorToFloorHeight || 3.1) - level.slabThickness),
            material: 'plaster' as const,
          }
          edit((model) => ({ ...model, walls: [...model.walls, next] }))
          setMessage('')
          setCurveDraft([])
        }
      }
    }
    if (tool === 'ramp') {
      if (!rampDraft.length) setRampDraft([p])
      else if (distance(rampDraft[0], p) > 0.3) {
        const next: Ramp = {
          id: uid('ramp'),
          start: rampDraft[0],
          end: p,
          width: 1.2,
          thickness: 0.15,
          startElevation: 0,
          endElevation: 0.45,
          material: 'reinforced-concrete',
        }
        edit((model) => ({ ...model, ramps: [...model.ramps, next] }))
        setRampDraft([])
      }
    }
    if (tool === 'door' || tool === 'window') {
      if (review) {
        setMessage('Classify detected gaps in Openings, or place new openings after accepting the walls.')
        return
      }
      const host = nearestWall(raw)
      if (!host) {
        setMessage('Click near a wall to place an opening.')
        return
      }
      const wall = level.walls.find((item) => item.id === host.id)!
      const width = tool === 'door' ? 0.9 : 1.4
      if (wallLength(wall) < width + 0.1) {
        setMessage('This wall is too short for the opening.')
        return
      }
      setMessage('')
      const offset = Math.max(0.05, Math.min(wallLength(wall) - width - 0.05, host.offset - width / 2))
      if (tool === 'door') {
        const next = { id: uid('door'), wallId: host.id, offset, width, height: 2.1, hinge: 'left' as const }
        const issue = validateOpening(level, next)
        if (issue) setMessage(issue)
        else edit((model) => ({ ...model, doors: [...model.doors, next] }))
      } else {
        const next = { id: uid('window'), wallId: host.id, offset, width, height: 1.25, sill: 0.9 }
        const issue = validateOpening(level, next)
        if (issue) setMessage(issue)
        else edit((model) => ({ ...model, windows: [...model.windows, next] }))
      }
    }
    if (tool === 'room') setDraft((points) => [...points, p])
    if (tool === 'measure') setMeasure((points) => (points.length === 1 ? [points[0], p] : [p]))
    if (tool === 'select') select(null)
  }
  const move = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.pointerType === 'mouse' && (pan || dragMatrix.current)) {
      const bounds = svg.current!.getBoundingClientRect()
      if (
        event.clientX < bounds.left ||
        event.clientX > bounds.right ||
        event.clientY < bounds.top ||
        event.clientY > bounds.bottom
      ) {
        setSnapGuide(null)
        finishDrag()
        return
      }
    }
    const p = point(event)
    const aligned = event.shiftKey
      ? p
      : snap(
          p,
          tool === 'wall' && draft.length
            ? draft[0]
            : tool === 'curve' && curveDraft.length
              ? curveDraft[0]
              : tool === 'ramp' && rampDraft.length
                ? rampDraft[0]
                : undefined,
        )
    setCursor(aligned)
    setSnapGuide(distance(p, aligned) > 0.001 ? aligned : null)
    if (pan) {
      setBox((current) => ({ ...current, x: current.x + pan.x - p.x, z: current.z + pan.z - p.z }))
      return
    }
    editing.move(p, event.shiftKey)
  }
  const finishRoom = () => {
    if (previewOnly) return
    if (draft.length >= 3)
      edit((model) => ({
        ...model,
        rooms: [
          ...model.rooms,
          { id: uid('room'), name: `Room ${model.rooms.length + 1}`, polygon: draft, material: 'oak' },
        ],
      }))
    else setMessage('A room needs at least three points.')
    setDraft([])
  }
  const finishDrag = () => {
    dragMatrix.current = null
    setPan(null)
    editing.finish()
  }
  const cancelDrag = () => {
    dragMatrix.current = null
    setPan(null)
    editing.cancel()
  }
  const captureDrag = (pointerId: number) => {
    const canvas = svg.current!
    canvas.setPointerCapture(pointerId)
    editing.setCleanup(bindDragBoundary(canvas, pointerId, finishDrag, cancelDrag))
  }
  return (
    <section className="plan-editor">
      <div className="viewport-head">
        <span>{level.name.toUpperCase()} · PLAN</span>
        <div>
          <PlanSettings grid={grid} setGrid={setGrid} unit={unit} />
          <button onClick={() => setBox(fitBounds(level, source, fence))}>Fit</button>
          {tool === 'room' && draft.length > 2 && <button onClick={finishRoom}>Close room</button>}
          {(draft.length > 0 || curveDraft.length > 0 || rampDraft.length > 0) && (
            <button
              onClick={() => {
                setDraft([])
                setCurveDraft([])
                setRampDraft([])
              }}
            >
              Cancel
            </button>
          )}
        </div>
      </div>
      <svg
        ref={svg}
        tabIndex={0}
        aria-label="Editable floor plan"
        onKeyDown={(event) => {
          if (event.key === 'Escape') cancelDrag()
          else editing.keyboard(event)
        }}
        onPointerDownCapture={(event) => {
          svg.current?.focus()
          if (previewOnly) {
            event.stopPropagation()
            down(event)
          }
        }}
        className={`plan-svg tool-${tool}${pan ? ' is-dragging' : ''}`}
        viewBox={`${box.x} ${box.z} ${box.width} ${box.height}`}
        onPointerDown={down}
        onPointerMove={move}
        onPointerLeave={() => setSnapGuide(null)}
        onPointerUp={finishDrag}
        onPointerCancel={cancelDrag}
        onDoubleClick={finishRoom}
      >
        <defs>
          <pattern id="grid-minor" width={grid.step} height={grid.step} patternUnits="userSpaceOnUse">
            <path
              d={`M ${grid.step} 0 L 0 0 0 ${grid.step}`}
              fill="none"
              stroke="#cbd5ca"
              strokeWidth=".008"
            />
          </pattern>
          <pattern id="grid-major" width="1" height="1" patternUnits="userSpaceOnUse">
            <path d="M 1 0 L 0 0 0 1" fill="none" stroke="#aebbae" strokeWidth=".018" />
          </pattern>
        </defs>
        <rect x={-1000} y={-1000} width={2000} height={2000} fill="#f4f5f2" />
        {underlay && <LevelUnderlay level={underlay} />}
        {source && (!review || review.view.source) && (
          <image
            href={source.url}
            x={source.x}
            y={source.z}
            width={source.width}
            height={source.height}
            opacity={review?.view.opacity ?? 0.6}
          />
        )}
        {!review && <SlabLayer slabs={level.slabs || []} />}
        {grid.visible && (
          <g opacity={source ? 0.55 : 1} pointerEvents="none">
            <rect x={-1000} y={-1000} width={2000} height={2000} fill="url(#grid-minor)" />
            <rect x={-1000} y={-1000} width={2000} height={2000} fill="url(#grid-major)" />
          </g>
        )}
        {review && (
          <ReviewLayer
            svg={svg}
            {...review}
            selectSpace={tool === 'select' ? review.selectSpace : undefined}
          />
        )}
        {!review && (
          <PlanRoomLayer rooms={level.rooms} selection={selection} select={select} tool={tool} unit={unit} />
        )}
        {!review && <StructureEditLayer level={level} select={select} />}
        {!review && (
          <InterpretationLayer
            details={level.stairGuides?.map((guide) => ({
              ...guide,
              kind: 'stair' as const,
              confidence: 0.8,
            }))}
          />
        )}
        {!review && (
          <WallLayer
            walls={level.walls}
            selection={selection}
            drag={null}
            tool={tool}
            unit={unit}
            onWallDown={(event, wall) => {
              dragMatrix.current = svg.current!.getScreenCTM()!.inverse()
              event.stopPropagation()
              select({ kind: 'wall', id: wall.id })
              editing.start('move', point(event))
              captureDrag(event.pointerId)
            }}
            onEndDown={(event, wall, end) => {
              dragMatrix.current = svg.current!.getScreenCTM()!.inverse()
              event.stopPropagation()
              select({ kind: 'wall', id: wall.id })
              editing.start(end === 'start' ? 0 : 1, point(event))
              captureDrag(event.pointerId)
            }}
          />
        )}
        {!review && <RampLayer ramps={level.ramps || []} selection={selection} select={select} tool={tool} />}
        {!review && <SystemsLayer level={level} selection={selection} select={select} />}
        {!review && (
          <SeatingLayer
            sections={level.seatingSections || []}
            selection={selection}
            select={select}
            tool={tool}
          />
        )}
        {!review && (
          <ArchitecturalDetailLayer
            details={level.details || []}
            selection={selection}
            select={select}
            tool={tool}
          />
        )}
        {!review && (
          <OpeningLayer svg={svg} level={level} selection={selection} select={select} tool={tool} />
        )}
        <FurnitureLayer level={level} selection={selection} select={select} />
        {fence && (
          <FencePlanLayer
            svg={svg}
            fence={fence}
            selected={selection?.kind === 'fence'}
            select={select}
            enabled={tool === 'select'}
          />
        )}
        {!review && !previewOnly && <ElementHandles svg={svg} level={level} size={box.width} />}
        <PlanDraftLayer
          tool={tool}
          draft={draft}
          curveDraft={curveDraft}
          rampDraft={rampDraft}
          cursor={cursor}
          snapGuide={snapGuide}
          measure={measure}
          unit={unit}
        />
      </svg>
      <div className={`viewport-foot${message || editing.message ? ' viewport-feedback' : ''}`} role="status">
        {message ||
          (tool === 'wall'
            ? 'Click two points to draw · Shift disables snap · Esc cancels'
            : tool === 'curve'
              ? `Click start, bulge, end · ${curveDraft.length}/2 points · Esc cancels`
              : tool === 'ramp'
                ? 'Click ramp start and end · Esc cancels'
                : tool === 'room'
                  ? 'Click vertices · Double click or Close room to finish'
                  : tool === 'measure'
                    ? 'Click two points to measure'
                    : editing.message ||
                      'Select → drag handles · Arrows move · Shift fine · [ / ] rotate · , / . resize · PgUp / PgDn height · Ctrl scroll zoom')}
      </div>
    </section>
  )
}
