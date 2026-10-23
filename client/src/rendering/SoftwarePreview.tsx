import { useEffect, useMemo, useRef, useState } from 'react'
import type { Building, Level, Selection } from '../domain/types'
import { atWall, wallBoundsPoints, wallSubpath } from '../geometry/math'
import { type Vertex } from '../geometry/roof'
import { wallSolids } from '../geometry/walls'
import { zoomEvent, type ZoomDetail } from '../app/useWorkspaceZoom'
import { projectSoftware as project } from './softwareProjection'
import { SoftwareElementHandles } from './SoftwareElementHandles'
import { verandaGeometry } from '../geometry/veranda'
import { softwareDetails, type SoftwareFace as Face } from './softwareDetails'
import { softwareRoofs } from './softwareRoofs'
import { softwareFurniture } from '../furniture/softwareFurniture'
import { useFurnitureReview } from '../furniture/reviewState'

const depth = (points: Vertex[]) => points.reduce((sum, [x, , z]) => sum + x + z, 0) / points.length
const asPoints = (vertices: Vertex[], top: boolean) =>
  vertices.map((p) => project(p, top).join(',')).join(' ')

export function SoftwarePreview({
  level,
  levels = [level],
  building,
  selection,
  select,
  roofShown,
  top,
  sectionHeight,
}: {
  level: Level
  levels?: Level[]
  building?: Building
  selection: Selection
  select: (value: Selection) => void
  roofShown: boolean
  top: boolean
  sectionHeight: number | null
}) {
  const svg = useRef<SVGSVGElement>(null)
  const furnitureShown = useFurnitureReview((state) => state.shown)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const drag = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null)
  const geometry = useMemo(() => {
    const points = wallBoundsPoints(level.walls)
    const minX = points.length ? Math.min(...points.map((p) => p.x)) : 0
    const maxX = points.length ? Math.max(...points.map((p) => p.x)) : 8
    const minZ = points.length ? Math.min(...points.map((p) => p.z)) : 0
    const maxZ = points.length ? Math.max(...points.map((p) => p.z)) : 6
    const slab: Vertex[] = [
      [minX - 0.25, 0, minZ - 0.25],
      [maxX + 0.25, 0, minZ - 0.25],
      [maxX + 0.25, 0, maxZ + 0.25],
      [minX - 0.25, 0, maxZ + 0.25],
    ]
    const faces: Face[] = level.slabs?.length
      ? level.slabs.map((item) => ({
          key: item.id,
          vertices: item.polygon.map((point) => [point.x, item.elevation, point.z] as Vertex),
          fill: '#bcb9ad',
          depth: -1000,
          select: { kind: 'slab', id: item.id },
        }))
      : level.autoSlab === false
        ? []
        : [{ key: 'slab', vertices: slab, fill: '#bcb9ad', depth: -1000 }]
    for (const wall of level.walls) {
      for (const [i, solid] of wallSolids(wall, level.doors, level.windows, level.passages || []).entries()) {
        const high = sectionHeight === null ? solid.top : Math.min(solid.top, sectionHeight)
        if (high <= solid.bottom) continue
        const selected = selection?.kind === 'wall' && selection.id === wall.id
        const path = wallSubpath(wall, solid.start, solid.end, 0.35)
        for (let segment = 0; segment < path.length - 1; segment++) {
          const a = path[segment],
            b = path[segment + 1],
            dx = b.x - a.x,
            dz = b.z - a.z
          const segmentLength = Math.hypot(dx, dz) || 1,
            offsetX = ((-dz / segmentLength) * wall.thickness) / 2,
            offsetZ = ((dx / segmentLength) * wall.thickness) / 2
          const base: Vertex[] = [
            [a.x + offsetX, solid.bottom, a.z + offsetZ],
            [b.x + offsetX, solid.bottom, b.z + offsetZ],
            [b.x + offsetX, high, b.z + offsetZ],
            [a.x + offsetX, high, a.z + offsetZ],
          ]
          const cap: Vertex[] = [
            [a.x + offsetX, high, a.z + offsetZ],
            [b.x + offsetX, high, b.z + offsetZ],
            [b.x - offsetX, high, b.z - offsetZ],
            [a.x - offsetX, high, a.z - offsetZ],
          ]
          faces.push({
            key: `${wall.id}-${i}-${segment}`,
            vertices: base,
            fill: selected ? '#c1a875' : wall.color || '#dedbd1',
            stroke: '#8d8f88',
            depth: depth(base),
            select: { kind: 'wall', id: wall.id },
          })
          faces.push({
            key: `${wall.id}-${i}-${segment}-cap`,
            vertices: cap,
            fill: selected ? '#ddc798' : '#f1efe8',
            stroke: '#aaa99f',
            depth: depth(cap) + 0.001,
            select: { kind: 'wall', id: wall.id },
          })
        }
      }
    }
    for (const door of level.doors) {
      const wall = level.walls.find((w) => w.id === door.wallId)
      if (!wall) continue
      const a = atWall(wall, door.offset),
        b = atWall(wall, door.offset + door.width)
      const vertices: Vertex[] = [
        [a.x, 0, a.z],
        [b.x, 0, b.z],
        [b.x, door.height, b.z],
        [a.x, door.height, a.z],
      ]
      faces.push({
        key: door.id,
        vertices,
        fill: selection?.id === door.id ? '#c69c56' : '#876b52',
        stroke: '#594a3b',
        depth: depth(vertices) + 0.1,
        select: { kind: 'door', id: door.id },
      })
      const veranda = verandaGeometry(level, door)
      if (veranda) {
        const vertices = veranda.polygon.map((p) => [p.x, 0, p.z] as Vertex)
        faces.push({
          key: `veranda:${door.id}`,
          vertices,
          fill: '#c9c6b2',
          depth: -999,
          select: { kind: 'door', id: door.id },
        })
      }
    }
    for (const window of level.windows) {
      const wall = level.walls.find((w) => w.id === window.wallId)
      if (!wall) continue
      const a = atWall(wall, window.offset),
        b = atWall(wall, window.offset + window.width)
      const vertices: Vertex[] = [
        [a.x, window.sill, a.z],
        [b.x, window.sill, b.z],
        [b.x, window.sill + window.height, b.z],
        [a.x, window.sill + window.height, a.z],
      ]
      faces.push({
        key: window.id,
        vertices,
        fill: selection?.id === window.id ? '#e6ce96' : '#91b9c4',
        stroke: '#4c626a',
        depth: depth(vertices) + 0.1,
        select: { kind: 'window', id: window.id },
      })
    }
    if (roofShown && sectionHeight === null) faces.push(...softwareRoofs(level, building))
    faces.push(...softwareDetails(level, levels, roofShown))
    if (furnitureShown) faces.push(...softwareFurniture(level))
    faces.sort((a, b) => a.depth - b.depth)
    const projected = faces.length
      ? faces.flatMap((f) => f.vertices.map((p) => project(p, top)))
      : [
          [0, 0],
          [8, 6],
        ]
    const left = Math.min(...projected.map((p) => p[0])),
      right = Math.max(...projected.map((p) => p[0]))
    const upper = Math.min(...projected.map((p) => p[1])),
      lower = Math.max(...projected.map((p) => p[1]))
    return {
      faces,
      centerX: (left + right) / 2,
      centerY: (upper + lower) / 2,
      width: Math.max(4, right - left) * 1.25,
      height: Math.max(4, lower - upper) * 1.35,
    }
  }, [level, levels, building, selection, roofShown, top, sectionHeight, furnitureShown])
  const [frame, setFrame] = useState(() => geometry),
    geometryRef = useRef(geometry)
  useEffect(() => {
    geometryRef.current = geometry
  }, [geometry])
  useEffect(() => {
    const host = svg.current?.closest('.viewer')
    const onZoom = (event: Event) => {
      const detail = (event as CustomEvent<ZoomDetail>).detail
      if (detail.reset) {
        setZoom(1)
        setPan({ x: 0, y: 0 })
        setFrame(geometryRef.current)
      } else setZoom((value) => Math.max(0.2, Math.min(8, value / (detail.factor || 1))))
    }
    host?.addEventListener(zoomEvent, onZoom)
    return () => host?.removeEventListener(zoomEvent, onZoom)
  }, [])
  const width = frame.width / zoom,
    height = frame.height / zoom
  return (
    <div className="software-preview">
      <svg
        ref={svg}
        role="img"
        aria-label="Software-rendered 3D building preview"
        viewBox={`${frame.centerX + pan.x - width / 2} ${frame.centerY + pan.y - height / 2} ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        onWheel={(event) => {
          event.preventDefault()
          event.stopPropagation()
          setZoom((value) => Math.max(0.2, Math.min(8, value * Math.exp(-event.deltaY * 0.001))))
        }}
        onPointerDown={(event) => {
          if (event.button !== 0 && event.button !== 1) return
          drag.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y }
          event.currentTarget.setPointerCapture(event.pointerId)
        }}
        onPointerMove={(event) => {
          if (!drag.current) return
          const rect = event.currentTarget.getBoundingClientRect(),
            start = drag.current
          setPan({
            x: start.panX - ((event.clientX - start.x) * width) / rect.width,
            y: start.panY - ((event.clientY - start.y) * height) / rect.height,
          })
        }}
        onPointerUp={() => {
          drag.current = null
        }}
      >
        <rect
          x={geometry.centerX - 1000}
          y={geometry.centerY - 1000}
          width="2000"
          height="2000"
          fill="#e6eae6"
        />
        {geometry.faces.map((face) => (
          <polygon
            key={face.key}
            points={asPoints(face.vertices, top)}
            fill={face.fill}
            stroke={face.stroke || 'none'}
            strokeWidth=".025"
            strokeLinejoin="round"
            style={{ cursor: face.select ? 'pointer' : undefined }}
            onClick={(event) => {
              event.stopPropagation()
              if (face.select) select(face.select)
            }}
          />
        ))}
        <SoftwareElementHandles svg={svg} level={level} top={top} size={width} />
      </svg>
      <span className="software-preview-note">
        3D preview · WebGL unavailable. Walkthrough needs a WebGL enabled browser.
      </span>
    </div>
  )
}
