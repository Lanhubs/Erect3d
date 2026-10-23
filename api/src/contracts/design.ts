import { z } from 'zod'
import { id, material, color } from './primitives'
import { roof } from './roof-site'
const evidence = {
  id,
  label: z.string().min(1).max(200),
  rationale: z.string().min(1).max(2000),
  origin: z.enum(['inferred', 'defaulted']),
  confidence: z.number().min(0).max(1),
  uncertainties: z.array(z.string().max(500)).max(20),
  needsReview: z.literal(true),
}
export const designSchema = z.discriminatedUnion('kind', [
  z.object({ ...evidence, kind: z.literal('roof'), roof }).strict(),
  z
    .object({
      ...evidence,
      kind: z.literal('wall-finish'),
      entityIds: z.array(id).min(1).max(2000),
      material,
      color: color.optional(),
    })
    .strict(),
  z
    .object({
      ...evidence,
      kind: z.literal('glazing'),
      entityIds: z.array(id).min(1).max(2000),
      frame: z.enum(['aluminium', 'timber']),
      glazing: z.enum(['clear', 'frosted']),
      type: z.enum(['fixed', 'sliding', 'casement']),
    })
    .strict(),
])
export type DesignProposal = z.infer<typeof designSchema>
