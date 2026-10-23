import { z } from 'zod'
import { color, id, name, point, polygon, positive, scalar } from './primitives'

export const roof = z
  .object({
    shape: z.enum([
      'hidden',
      'gable',
      'hip',
      'shed',
      'mansard',
      'butterfly',
      'terrace',
      'cross-gable',
      'cross-hip',
      'arena-vault',
    ]),
    material: z.enum([
      'concrete',
      'standing-seam',
      'corrugated',
      'concrete-tile',
      'long-span-metal',
      'stone-coated-metal',
      'clay-tile',
      'shingle',
      'membrane',
      'glass',
    ]),
    color,
    pitch: z.number().min(0).max(85),
    overhang: z.number().min(0).max(100),
    ridgeDirection: z.enum(['auto', 'x', 'z']).optional(),
    fasciaDepth: positive.optional(),
    elevationOffset: scalar.optional(),
  })
  .strict()
export const roofSection = z
  .object({
    id,
    name,
    levelId: id,
    footprint: polygon,
    voids: z.array(polygon).max(1000).optional(),
    topHeight: positive.optional(),
    followFootprint: z.boolean().optional(),
    framingSpacing: positive.optional(),
    automatic: z.boolean().optional(),
    roof,
  })
  .strict()
const fenceMaterial = z.enum(['timber', 'metal', 'concrete', 'brick'])
export const fence = z
  .object({
    id,
    name,
    height: positive,
    thickness: positive,
    material: fenceMaterial,
    segments: z
      .array(
        z
          .object({
            id,
            start: point,
            end: point,
            height: positive,
            thickness: positive,
            material: fenceMaterial.optional(),
            color: color.optional(),
          })
          .strict(),
      )
      .max(4096),
    gates: z
      .array(
        z
          .object({
            id,
            kind: z.enum(['pedestrian', 'vehicle']),
            segmentId: id,
            offset: scalar,
            width: positive,
            height: positive,
            material: fenceMaterial.optional(),
            color: color.optional(),
          })
          .strict(),
      )
      .max(1000),
    enabled: z.boolean().optional(),
    color: color.optional(),
    boundary: polygon.optional(),
    mode: z.enum(['automatic', 'manual']).optional(),
    setbacks: z.object({ front: scalar, rear: scalar, left: scalar, right: scalar }).strict().optional(),
  })
  .strict()
