import { z } from 'zod'
import { operationSchema } from '../contracts/operations'
import { id, point, revision, scalar } from '../contracts/primitives'
export const presenceSchema = z
  .object({
    cursor: point.optional(),
    camera: z.object({ x: scalar, y: scalar, z: scalar, yaw: scalar, pitch: scalar }).strict().optional(),
    selection: z.array(id).max(50).optional(),
    activeLevelId: id.optional(),
    editingEntityId: id.optional(),
    typing: z.boolean().optional(),
  })
  .strict()
export const messageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('operation.apply'), operation: operationSchema }).strict(),
  z.object({ type: z.literal('presence.update'), presence: presenceSchema }).strict(),
  z.object({ type: z.literal('lock.acquire'), entityId: id }).strict(),
  z.object({ type: z.literal('lock.release'), entityId: id }).strict(),
  z.object({ type: z.literal('resume'), afterRevision: revision }).strict(),
  z.object({ type: z.literal('pong') }).strict(),
])
export type RealtimeMessage = z.infer<typeof messageSchema>
export const maximumMessageBytes = 512 * 1024
