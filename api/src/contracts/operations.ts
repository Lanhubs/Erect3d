import { z } from 'zod'
import { entityPath, id, revision } from './primitives'
const jsonValue: z.ZodType<unknown> = z.json()
export const changeSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('put'), path: entityPath, value: jsonValue }).strict(),
  z.object({ action: z.literal('delete'), path: entityPath }).strict(),
])
export const operationSchema = z
  .object({
    operationId: id,
    baseRevision: revision,
    type: z.literal('document.patch'),
    entityId: id,
    payload: z.object({ changes: z.array(changeSchema).min(1).max(512) }).strict(),
  })
  .strict()
export type Operation = z.infer<typeof operationSchema>
export type Change = z.infer<typeof changeSchema>
export type AcceptedOperation = Operation & { revision: number; actorId: string; modifiedAt: number }
