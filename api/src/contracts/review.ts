import { z } from 'zod'
import { id, name, point, scalar, revision } from './primitives'
export const anchorSchema = z.object({
  entityId: id.optional(), levelId: id.optional(), point2d: point.optional(),
  point3d: z.object({ x: scalar, y: scalar, z: scalar }).strict().optional(),
  viewpointId: id.optional(), screenshotAssetId: id.optional(),
}).strict()
export const commentSchema = z.object({ text: z.string().trim().min(1).max(10000),
  parentId: id.optional(), anchor: anchorSchema, mentions: z.array(id).max(20).default([]) }).strict()
export const issueSchema = z.object({ title: name, description: z.string().max(10000),
  anchor: anchorSchema, assigneeId: id.optional(),commentId:id.optional(),
  priority:z.enum(['LOW','MEDIUM','HIGH','CRITICAL']).default('MEDIUM') }).strict()
export const approvalSchema = z.object({ versionId: id.optional(), levelId: id.optional(), presentationId: id.optional(),
  baseRevision:revision.optional(),decision: z.enum(['APPROVED', 'CHANGES_REQUESTED']), note: z.string().max(10000) }).strict()
  .refine(value => [value.versionId, value.levelId, value.presentationId].filter(Boolean).length === 1, 'Choose exactly one approval target')
  .refine(value => !!value.versionId || value.baseRevision !== undefined, 'Provide the revision reviewed for a level or presentation')
export const savedViewSchema = z.object({
  name, levelId: id, position: z.object({ x: scalar, y: scalar, z: scalar }).strict(),
  target: z.object({ x: scalar, y: scalar, z: scalar }).strict(), projection: z.enum(['perspective', 'orthographic']),
}).strict()
export const presentationSchema = z.object({ name, versionId: id.optional(),
  viewIds: z.array(id).max(200), durationSeconds: z.number().min(1).max(3600), loop: z.boolean().default(false) }).strict()
