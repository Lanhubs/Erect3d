import { z } from 'zod'
import { id, revision, point } from './primitives'
export const assistantScope = z
  .object({
    mode: z.enum(['selection', 'level', 'building']),
    buildingId: id,
    levelId: id,
    entityId: id.optional(),
    floorIndex: z.number().int().min(0).optional(),
  })
  .strict()
export const assistantMessage = z
  .object({
    message: z.string().trim().min(1).max(8000),
    baseRevision: revision,
    scope: assistantScope,
    planSourceIds: z.array(id).max(3).default([]),
    previousRunId: id.optional(),
  })
  .strict()
export const assistantApply = z.object({ operationId: id, baseRevision: revision }).strict()
export const elementKinds = [
  'wall',
  'door',
  'window',
  'passage',
  'room',
  'slab',
  'column',
  'stair',
  'ramp',
  'detail',
  'furniture',
  'system',
  'roof-section',
  'level',
  'roof',
  'fence',
] as const
export const editCommand = z.discriminatedUnion('action', [
  z
    .object({ action: z.literal('set'), kind: z.enum(elementKinds), id, properties: z.string().max(100000) })
    .strict(),
  z
    .object({
      action: z.literal('create'),
      kind: z.enum(elementKinds),
      levelId: id,
      properties: z.string().max(100000),
    })
    .strict(),
  z.object({ action: z.literal('remove'), kind: z.enum(elementKinds), id }).strict(),
  z
    .object({
      action: z.literal('transform'),
      kind: z.enum([
        'wall',
        'door',
        'window',
        'passage',
        'room',
        'slab',
        'column',
        'stair',
        'ramp',
        'detail',
        'furniture',
        'system',
        'fence',
      ]),
      id,
      move: point.optional(),
      rotate: z.number().finite().optional(),
      scale: z.number().finite().positive().max(20).optional(),
      height: z.number().finite().optional(),
    })
    .strict(),
  z
    .object({
      action: z.literal('duplicate-level'),
      id,
      name: z.string().min(1).max(200),
      elevation: z.number().finite(),
    })
    .strict(),
  z.object({ action: z.literal('detach-floor'), id, index: z.number().int().min(0) }).strict(),
  z
    .object({
      action: z.literal('connect-stair'),
      levelId: id,
      toLevelId: id,
      guideId: id.optional(),
      start: point.optional(),
      width: z.number().positive().optional(),
      form: z.enum(['straight', 'L', 'U']),
    })
    .strict(),
])
export type AssistantScope = z.infer<typeof assistantScope>
export type EditCommand = z.infer<typeof editCommand>
export type AssistantRun = {
  id: string
  status: string
  progress: string
  base_revision: number
  scope: AssistantScope
  summary?: string
  failure_code?: string
  proposal?: {
    document: import('./project').Project
    changes: import('./operations').Change[]
    descriptions: string[]
  }
  applied_revision?: number
}
