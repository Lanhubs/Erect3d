import { z } from 'zod'
export const windowConstructionFields = {
  frameWidth: z.number().positive().max(0.3).optional(),
  frameDepth: z.number().positive().max(0.5).optional(),
  frameOffset: z.number().min(-0.5).max(0.5).optional(),
  mullions: z.number().int().min(0).max(12).optional(),
  transoms: z.number().int().min(0).max(12).optional(),
  sillProjection: z.number().min(0).max(0.5).optional(),
}
export const windowConstructionSchema = z.object(windowConstructionFields).strict()
