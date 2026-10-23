import { z } from 'zod'
import { id } from './primitives'
import { typology, floorLayoutEvidence } from './architecture'
import { maxFloorInstances } from '../../../client/src/domain/floorRepetition'
import { articulationProfiles, architecturalSurfaces } from '../../../client/src/domain/articulation'
const dimension = z.number().positive().max(2000)
const base = {
  id,
  name: z.string().min(1).max(200),
  boundaryId: id.optional(),
  origin: z.enum(['detected', 'inferred', 'design-proposal']),
  evidence: z.string().min(1).max(2000),
  assumptions: z.array(z.string().min(1).max(500)).max(20).optional(),
  profile: z.enum(articulationProfiles).optional(),
  material: z.enum(architecturalSurfaces).optional(),
  side: z.enum(['left', 'right']).optional(),
  repeatWithFloor: z.boolean().optional(),
  clockwise: z.boolean().optional(),
  layoutEvidence: floorLayoutEvidence.optional(),
  role: z.enum(['atrium', 'courtyard', 'shaft', 'podium', 'tower', 'wing', 'crown', 'mechanical']).optional(),
}
const parameters = z
  .object({
    height: dimension.optional(),
    width: dimension.optional(),
    thickness: dimension.optional(),
    radius: dimension.optional(),
    riserHeight: dimension.optional(),
    turnHeight: dimension.optional(),
    rotation: z.number().finite().optional(),
    bayWidth: dimension.optional(),
    transomHeight: dimension.optional(),
    depth: dimension.optional(),
    spacing: dimension.optional(),
    count: z.number().int().min(1).max(maxFloorInstances).optional(),
    floorHeight: dimension.optional(),
    elevation: z.number().finite().optional(),
  })
  .strict()
const source = { ...base, boundaryId: id, parameters: parameters.extend({ height: dimension }) }
// Canonical per-kind dimensions stay strict even when the provider uses a
// shallower wire grammar to satisfy its structured-output complexity limit.
export const architecturalRequirements = z
  .object({
    typology,
    systems: z
      .array(
        z.discriminatedUnion('kind', [
          z.object({ ...source, kind: z.literal('core') }).strict(),
          z.object({ ...source, kind: z.literal('shaft') }).strict(),
          z.object({ ...source, kind: z.literal('void') }).strict(),
          z.object({ ...source, kind: z.literal('beam') }).strict(),
          z.object({ ...source, kind: z.literal('curtain-wall') }).strict(),
          z.object({ ...source, kind: z.literal('massing') }).strict(),
          z
            .object({
              ...source,
              kind: z.literal('spiral-stair'),
              parameters: parameters.extend({
                height: dimension,
                radius: dimension,
                width: dimension,
                riserHeight: dimension.max(0.4),
                turnHeight: dimension,
              }),
            })
            .strict(),
          z
            .object({
              ...source,
              kind: z.literal('articulation'),
              profile: z.enum(articulationProfiles),
              parameters: parameters.extend({
                height: dimension,
                depth: dimension,
                thickness: dimension,
                spacing: dimension,
              }),
            })
            .strict(),
          z
            .object({
              ...base,
              kind: z.literal('typical-floors'),
              parameters: parameters.extend({
                count: z.number().int().min(1).max(maxFloorInstances),
                floorHeight: dimension,
              }),
            })
            .strict(),
        ]),
      )
      .max(200),
  })
  .strict()
export type ArchitecturalRequirements = z.infer<typeof architecturalRequirements>
