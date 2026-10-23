import {
  BoxGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  Matrix4,
  Path,
  Shape,
  type BufferGeometry,
} from 'three'
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js'
import type { Level } from '../domain/types'
import { wallSolids, wallRects } from './walls'
import { atWall, wallTangentAngle } from './math'
export type FloorPackage = { slot: string; color: string; geometry: BufferGeometry }
export function floorPackages(level: Level): FloorPackage[] {
  const groups = new Map<string, { slot: string; color: string; geometries: BufferGeometry[] }>()
  const add = (slot: string, color: string, geometry: BufferGeometry) => {
    const key = slot + color,
      row = groups.get(key) || { slot, color, geometries: [] }
    row.geometries.push(geometry)
    groups.set(key, row)
  }
  const box = (
    slot: string,
    color: string,
    center: number[],
    size: [number, number, number],
    rotation = 0,
  ) => {
    const g = new BoxGeometry(...size),
      m = new Matrix4().makeRotationY(rotation)
    m.setPosition(center[0], center[1], center[2])
    g.applyMatrix4(m)
    add(slot, color, g)
  }
  for (const wall of level.walls) {
    for (const solid of wallSolids(wall, level.doors, level.windows, level.passages))
      for (const rect of wallRects(wall, solid))
        box('solid', wall.color || '#c7c5bc', rect.center, rect.size, rect.rotation)
    for (const window of level.windows.filter((w) => w.wallId === wall.id)) {
      const p = atWall(wall, window.offset + window.width / 2),
        yaw = -wallTangentAngle(wall, window.offset + window.width / 2)
      box(
        'glass',
        '#a4c7d2',
        [p.x, window.sill + window.height / 2, p.z],
        [window.width, window.height, 0.03],
        yaw,
      )
      for (const side of [-1, 1]) {
        box(
          'metal',
          '#526069',
          [
            p.x + ((side * window.width) / 2) * Math.cos(yaw),
            window.sill + window.height / 2,
            p.z - ((side * window.width) / 2) * Math.sin(yaw),
          ],
          [0.06, window.height, 0.1],
          yaw,
        )
        box(
          'metal',
          '#526069',
          [p.x, window.sill + ((side + 1) * window.height) / 2, p.z],
          [window.width, 0.06, 0.1],
          yaw,
        )
      }
    }
    for (const door of level.doors.filter((d) => d.wallId === wall.id)) {
      const p = atWall(wall, door.offset + door.width / 2)
      box(
        'solid',
        '#80644b',
        [p.x, door.height / 2, p.z],
        [door.width, door.height, 0.05],
        -wallTangentAngle(wall, door.offset + door.width / 2),
      )
    }
  }
  for (const slab of level.slabs || []) {
    const shape = new Shape()
    slab.polygon.forEach((p, i) => (i ? shape.lineTo(p.x, -p.z) : shape.moveTo(p.x, -p.z)))
    shape.closePath()
    for (const opening of slab.openings) {
      const hole = new Path()
      opening.polygon.forEach((p, i) => (i ? hole.lineTo(p.x, -p.z) : hole.moveTo(p.x, -p.z)))
      hole.closePath()
      shape.holes.push(hole)
    }
    const raw = new ExtrudeGeometry(shape, { depth: slab.thickness, bevelEnabled: false })
    raw.rotateX(-Math.PI / 2)
    raw.translate(0, slab.elevation - slab.thickness, 0)
    const indexed = mergeVertices(raw)
    raw.dispose()
    indexed.clearGroups()
    add('solid', slab.color || '#b6b6b0', indexed)
  }
  for (const column of level.columns || []) {
    if (column.shape === 'rectangular')
      box(
        'solid',
        '#a5aaa9',
        [column.position.x, column.height / 2, column.position.z],
        [column.width, column.height, column.depth],
        ((column.rotation || 0) * Math.PI) / 180,
      )
    else {
      const g = new CylinderGeometry(column.diameter / 2, column.diameter / 2, column.height, 16)
      g.translate(column.position.x, column.height / 2, column.position.z)
      add('solid', '#a5aaa9', g)
    }
  }
  const result: FloorPackage[] = []
  for (const row of groups.values()) {
    const geometry = mergeGeometries(row.geometries, false)
    row.geometries.forEach((g) => g.dispose())
    if (!geometry) throw new Error('Incompatible linked-floor geometry attributes.')
    geometry.computeBoundingBox()
    geometry.computeBoundingSphere()
    result.push({ slot: row.slot, color: row.color, geometry })
  }
  return result
}
