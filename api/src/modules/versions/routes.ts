import { Hono } from 'hono'
import { z } from 'zod'
import type { Database } from '../../db/connection'
import type { ApiEnv } from '../../middleware/types'
import { body, param, parse } from '../../contracts/http'
import { id, name, pagination, revision } from '../../contracts/primitives'
import { authorize } from '../../security/permissions'
import { requireValue } from '../../security/errors'
import { loadDocument } from '../projects/documents'
import { createVersion, restoreVersion, compareDocuments } from './service'

export function versionRoutes(db: Database,maximumBytes=33554432) {
  const routes = new Hono<ApiEnv>()
  routes.post('/:projectId/versions', async context => {
    const input = await body(context, z.object({ name }).strict())
    return context.json(await createVersion(db, context.get('actor'), param(context, 'projectId'), input.name, context.get('requestId')), 201)
  })
  routes.get('/:projectId/versions', async context => {
    const projectId = param(context, 'projectId')
    await authorize(db, context.get('actor'), projectId)
    const { cursor, limit } = parse(pagination, context.req.query())
    const rows = await db`SELECT * FROM versions WHERE project_id=${projectId} AND id>${cursor || ''} ORDER BY id LIMIT ${limit + 1}`
    return context.json({ items: rows.slice(0, limit), nextCursor: rows.length > limit ? rows[limit - 1].id : null })
  })
  routes.get('/:projectId/versions/:versionId', async context => {
    const projectId = param(context, 'projectId'), versionId = param(context, 'versionId')
    await authorize(db, context.get('actor'), projectId)
    const [version] = await db`SELECT * FROM versions WHERE id=${versionId} AND project_id=${projectId}`
    return context.json(await loadDocument(db, projectId, Number(requireValue(version).revision)))
  })
  routes.post('/:projectId/versions/:versionId/restore', async context => {
    const input = await body(context, z.object({ operationId: id, baseRevision: revision }).strict())
    return context.json(await restoreVersion(db, context.get('actor'), param(context, 'projectId'), param(context, 'versionId'),
      input.operationId, input.baseRevision, context.get('requestId'),maximumBytes))
  })
  routes.get('/:projectId/compare', async context => {
    const projectId = param(context, 'projectId')
    await authorize(db, context.get('actor'), projectId)
    const query = parse(z.object({ from: z.coerce.number().int().nonnegative(), to: z.coerce.number().int().nonnegative() }).strict(), context.req.query())
    const [left, right] = await Promise.all([loadDocument(db, projectId, query.from), loadDocument(db, projectId, query.to)])
    return context.json(compareDocuments(left.document, right.document))
  })
  return routes
}
