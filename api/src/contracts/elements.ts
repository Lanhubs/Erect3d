import { z } from 'zod'
import { color, finish, id, material, name, point, polygon, positive, scalar, slabMaterial } from './primitives'
import {windowConstructionFields} from './opening-construction'

export const wall = z.object({
  id, start: point, end: point, thickness: positive, height: positive, material,
  color: color.optional(), kind: z.enum(['exterior', 'interior', 'partition']).optional(),
  curve: z.object({ center: point, radius: positive, startAngle: scalar, endAngle: scalar }).strict().optional(),
}).strict()
const opening = { id, wallId: id, offset: scalar, width: positive, height: positive }
export const door = z.object({
  ...opening, hinge: z.enum(['left', 'right']), style: z.enum(['flush', 'panel', 'glazed', 'double']).optional(),
  swing: z.enum(['in', 'out']).optional(), material: z.enum(['timber', 'metal']).optional(),leafStyle:z.enum(['flush','panel','glazed']).optional(),
  veranda: z.object({ width: positive, depth: positive, side: z.enum(['left', 'right']),
    covered: z.boolean(), railing: z.boolean(), roofShape: z.enum(['shed', 'terrace']), floorMaterial: finish }).strict().optional(),
}).strict()
export const windowUnit = z.object({
  ...windowConstructionFields,
  ...opening, sill: scalar, frame: z.enum(['aluminium', 'timber']).optional(),
  type: z.enum(['fixed', 'sliding', 'casement']).optional(), glazing: z.enum(['clear', 'frosted']).optional(),
}).strict()
export const passage = z.object(opening).strict()
export const room = z.object({
  id, name, polygon, material, ceilingHeight: positive.optional(), category: z.string().max(100).optional(),
}).strict()
export const slabOpening = z.object({ id, polygon, kind: z.enum(['stair', 'shaft', 'void']) }).strict()
export const slab = z.object({
  id, polygon, thickness: positive, elevation: scalar, structuralMaterial: slabMaterial,
  finishMaterial: finish, color: color.optional(), textureScale: positive.optional(),
  openings: z.array(slabOpening).max(1000), autoFromWalls: z.boolean().optional(),
}).strict()
export const column = z.object({
  id, position: point, shape: z.enum(['rectangular', 'circular']), width: positive,
  depth: positive, diameter: positive, height: positive, material: z.enum(['concrete', 'steel', 'timber']),
  rotation: scalar.optional(),
}).strict()
export const stair = z.object({
  id, fromLevelId: id, toLevelId: id, start: point, direction: scalar, form: z.enum(['straight', 'L', 'U']),
  width: positive, riserHeight: positive, treadDepth: positive, landingLength: positive,
  openingId: id.optional(), guideId: id.optional(),
}).strict()
export const ramp = z.object({
  id, start: point, end: point, width: positive, thickness: positive,
  startElevation: scalar, endElevation: scalar, material: slabMaterial,
}).strict()
export const seating = z.object({
  id, name, start: point, end: point, outward: point, rows: z.number().int().positive().max(1000),
  seatsPerRow: z.number().int().positive().max(1000), rowDepth: positive, rowRise: positive,
  baseElevation: scalar, seatColor: color, aisle: z.boolean().optional(),
  rowWidthGrowth:z.number().finite().min(0).max(5).optional(),
}).strict()
export const detail = z.object({
  id, name, kind: z.enum(['railing', 'screen', 'fin', 'canopy', 'parapet', 'pergola', 'arch']),
  start: point, end: point, baseElevation: scalar, height: positive, depth: positive,
  spacing: positive, material: z.enum(['concrete', 'steel', 'timber', 'glass']), color: color.optional(),
}).strict()
export const stairGuide = z.object({
  id, polygon, treadCount: z.number().int().positive().optional(), evidence: z.string().max(2000),
}).strict()
