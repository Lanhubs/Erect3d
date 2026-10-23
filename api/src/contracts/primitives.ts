import { z } from 'zod'

export const id = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-zA-Z0-9_:.\-]+$/)
export const name = z.string().trim().min(1).max(200)
export const scalar = z.number().finite().min(-1_000_000).max(1_000_000)
export const positive = scalar.refine((value) => value > 0, 'Must be positive')
export const point = z.object({ x: scalar, z: scalar }).strict()
export const polygon = z.array(point).min(3).max(4096)
export const color = z.string().regex(/^#[a-fA-F0-9]{6}$/)
export const material = z.enum([
  'plaster',
  'concrete',
  'brick',
  'timber',
  'tile',
  'porcelain-tile',
  'laminate',
  'oak',
  'marble',
  'carpet',
  'polished-concrete',
])
export const finish = z.enum([
  'concrete',
  'polished-concrete',
  'tile',
  'porcelain-tile',
  'marble',
  'timber',
  'laminate',
  'carpet',
])
export const slabMaterial = z.enum(['reinforced-concrete', 'concrete', 'timber', 'steel-deck'])
export const calibration = z
  .object({
    a: point,
    b: point,
    knownMetres: positive,
    metresPerPixel: positive,
    method: z.enum(['auto', 'manual']).optional(),
    basisPixels: positive.optional(),
    basis: z.enum(['door-symbols', 'wall-thickness']).optional(),
  })
  .strict()
export const source = z
  .object({
    id,
    name,
    mime: z.enum(['image/png', 'image/jpeg', 'application/pdf']),
    originalBytes: z
      .number()
      .int()
      .positive()
      .max(200 * 1024 * 1024),
    width: z.number().int().positive().max(200_000),
    height: z.number().int().positive().max(200_000),
    page: z.number().int().positive().optional(),
    pages: z.number().int().positive().optional(),
  })
  .strict()
export const pagination = z
  .object({
    cursor: z.string().max(128).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(30),
  })
  .strict()
export const entityPath = z.array(id).min(1).max(12)
export const revision = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)
