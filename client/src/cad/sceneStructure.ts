import type { Level, Point, Ramp, SeatingSection } from '../domain/types'
import { furnitureFootprint } from '../furniture/entities'
import { localToWorld, stairOpening, stairSteps } from '../geometry/stairs'
import { cad, type CadEntity } from './types'

const ring = (points: Point[], layer: string): CadEntity | null =>
  points.length < 3 ? null : { kind: 'polyline', layer, points: points.map(cad), closed: true }

/** A rectangle around a rotated footprint centre, in model degrees. */
function box(position: Point, width: number, depth: number, rotationDegrees: number): Point[] {
  const angle = (rotationDegrees * Math.PI) / 180,
    cos = Math.cos(angle),
    sin = Math.sin(angle),
    corners: [number, number][] = [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ]
  return corners.map(([a, b]) => ({
    x: position.x + ((a * width) / 2) * cos - ((b * depth) / 2) * sin,
    z: position.z + ((a * width) / 2) * sin + ((b * depth) / 2) * cos,
  }))
}

function slabEntities(level: Level): CadEntity[] {
  const entities: CadEntity[] = []
  for (const slab of level.slabs || []) {
    const outline = ring(slab.polygon, 'A-SLAB')
    if (outline) entities.push(outline)
    for (const opening of slab.openings) {
      const hole = ring(opening.polygon, 'A-SLAB-OPEN')
      if (hole) entities.push(hole)
    }
  }
  return entities
}

function columnEntities(level: Level): CadEntity[] {
  const entities: CadEntity[] = []
  for (const column of level.columns || []) {
    if (column.shape === 'circular') {
      entities.push({
        kind: 'circle',
        layer: 'A-COLUMN',
        center: cad(column.position),
        radius: column.diameter / 2,
      })
      continue
    }
    const outline = ring(box(column.position, column.width, column.depth, column.rotation || 0), 'A-COLUMN')
    if (outline) entities.push(outline)
  }
  return entities
}

/** Each tread is drawn where it actually sits, so L and U flights read as built. */
function stairEntities(level: Level, levels: Level[]): CadEntity[] {
  const entities: CadEntity[] = []
  for (const stair of level.stairs || []) {
    const well = ring(stairOpening(stair, levels), 'A-STAIR')
    if (well) entities.push(well)
    for (const step of stairSteps(stair, levels)) {
      const along = step.turn === Math.PI / 2 ? step.width : step.depth,
        across = step.turn === Math.PI / 2 ? step.depth : step.width,
        corners: Point[] = box({ x: step.u, z: step.v }, along, across, 0).map((corner) =>
          localToWorld(stair, corner.x, corner.z),
        )
      const tread = ring(corners, 'A-STAIR')
      if (tread) entities.push(tread)
    }
  }
  return entities
}

/** A ramp is its centreline widened to the built run. */
function rampEntities(ramp: Ramp): CadEntity[] {
  const dx = ramp.end.x - ramp.start.x,
    dz = ramp.end.z - ramp.start.z,
    length = Math.hypot(dx, dz)
  if (length < 0.01) return []
  const nx = (-dz / length) * (ramp.width / 2),
    nz = (dx / length) * (ramp.width / 2)
  const corners = [
    { x: ramp.start.x + nx, z: ramp.start.z + nz },
    { x: ramp.end.x + nx, z: ramp.end.z + nz },
    { x: ramp.end.x - nx, z: ramp.end.z - nz },
    { x: ramp.start.x - nx, z: ramp.start.z - nz },
  ]
  const outline = ring(corners, 'A-RAMP')
  return outline ? [outline] : []
}

/** Row front lines follow the batter and width growth the section was designed with. */
function seatingEntities(section: SeatingSection): CadEntity[] {
  const dx = section.end.x - section.start.x,
    dz = section.end.z - section.start.z,
    length = Math.hypot(dx, dz)
  if (length < 0.01 || section.rows < 1) return []
  const ox = section.outward.x / (Math.hypot(section.outward.x, section.outward.z) || 1),
    oz = section.outward.z / (Math.hypot(section.outward.x, section.outward.z) || 1),
    ux = dx / length,
    uz = dz / length,
    grow = section.rowWidthGrowth || 0,
    reach = section.rows * section.rowDepth,
    entities: CadEntity[] = []
  const outer: Point[] = [
    {
      x: section.start.x + ox * reach - ux * grow * (section.rows - 1) * 0.5,
      z: section.start.z + oz * reach - uz * grow * (section.rows - 1) * 0.5,
    },
    {
      x: section.end.x + ox * reach + ux * grow * (section.rows - 1) * 0.5,
      z: section.end.z + oz * reach + uz * grow * (section.rows - 1) * 0.5,
    },
  ]
  const band = ring([section.start, section.end, outer[1], outer[0]], 'A-SEAT')
  if (band) entities.push(band)
  for (let row = 0; row < section.rows; row++) {
    const offset = (row + 0.5) * section.rowDepth,
      spread = (row * grow) / 2
    entities.push({
      kind: 'line',
      layer: 'A-SEAT',
      a: cad({
        x: section.start.x + ox * offset - ux * spread,
        z: section.start.z + oz * offset - uz * spread,
      }),
      b: cad({ x: section.end.x + ox * offset + ux * spread, z: section.end.z + oz * offset + uz * spread }),
    })
  }
  return entities
}

/** Level structure: slabs, columns, stairs, ramps, furniture and annotation runs. */
export function structureEntities(level: Level, levels: Level[]): CadEntity[] {
  const entities = [...slabEntities(level), ...columnEntities(level), ...stairEntities(level, levels)]
  for (const ramp of level.ramps || []) entities.push(...rampEntities(ramp))
  for (const section of level.seatingSections || []) entities.push(...seatingEntities(section))
  for (const object of level.furniture || []) {
    const footprint = ring(furnitureFootprint(object), 'A-FURN')
    if (footprint) entities.push(footprint)
  }
  for (const detail of level.details || [])
    entities.push({ kind: 'line', layer: 'A-ANNO', a: cad(detail.start), b: cad(detail.end) })
  return entities
}
