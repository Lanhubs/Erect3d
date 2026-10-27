import { z } from 'zod'
import { id } from './primitives'
const coord = z.number().min(0).max(1)
export const sourceTextSchema = z
  .object({
    version: z.literal(1),
    status: z.enum(['ready', 'partial', 'unavailable']),
    engine: z.literal('tesseract-local'),
    items: z
      .array(
        z
          .object({
            id,
            text: z.string().min(1).max(200),
            confidence: coord,
            bounds: z.object({ x: coord, y: coord, width: coord, height: coord }).strict(),
          })
          .strict(),
      )
      .max(300),
    warnings: z.array(z.string().max(500)).max(10),
  })
  .strict()
export const labelReadingsSchema = z
  .array(
    z
      .object({
        sourceId: id,
        role: z.enum(['space', 'dimension', 'annotation', 'title', 'site', 'unreadable']),
        reading: z.string().trim().min(1).max(200),
        candidateIds: z.array(id).max(12),
        reason: z.string().trim().min(1).max(500),
      })
      .strict(),
  )
  .max(300)
export type SourceText = z.infer<typeof sourceTextSchema>
export type SourceLabel = SourceText['items'][number]
export type LabelReading = z.infer<typeof labelReadingsSchema>[number]
