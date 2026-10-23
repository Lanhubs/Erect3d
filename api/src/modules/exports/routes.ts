import { Hono } from 'hono'
import { z } from 'zod'
import type { Database } from '../../db/connection'
import type { ApiEnv } from '../../middleware/types'
import type { ObjectStore } from '../../storage/objects'
import { requireStore } from '../../storage/objects'
import { body, param } from '../../contracts/http'
import { revision } from '../../contracts/primitives'
import { authorize } from '../../security/permissions'
import { requireValue } from '../../security/errors'
import { idempotent } from '../../security/idempotency'
import { enqueue } from '../../jobs/queue'
import { loadDocument } from '../projects/documents'
import { projectQuantities } from '../quantities/service'
export function exportRoutes(db: Database, store?: ObjectStore) {
  const routes = new Hono<ApiEnv>()
  routes.get('/:projectId/quantities', async (context) => {
    const projectId = param(context, 'projectId')
    await authorize(db, context.get('actor'), projectId)
    const snapshot = await loadDocument(db, projectId)
    return context.json({ revision: snapshot.revision, ...projectQuantities(snapshot.document) })
  })
  routes.post('/:projectId/exports', async (context) => {
    const projectId = param(context, 'projectId'),
      actor = context.get('actor')
    const input = await body(
      context,
      z.object({ format: z.enum(['project-json', 'quantities-json']), revision }).strict(),
    )
    requireStore(store)
    const result = await idempotent(
      db,
      actor.id,
      `export:${projectId}`,
      context.req.header('Idempotency-Key'),
      input,
      async (tx) => {
        await authorize(tx, actor, projectId)
        await loadDocument(tx, projectId, input.revision)
        return { jobId: await enqueue(tx, actor, projectId, 'export', input, context.get('requestId')) }
      },
    )
    return context.json(result, 202)
  })
  routes.get('/:projectId/jobs/:jobId', async (context) => {
    const projectId = param(context, 'projectId'),
      jobId = param(context, 'jobId')
    await authorize(db, context.get('actor'), projectId)
    const [job] =
      await db`SELECT id,kind,status,attempts,result,failure_code,created_at,started_at,completed_at
      FROM jobs WHERE id=${jobId} AND project_id=${projectId} AND (kind<>'assistant.edit' OR actor_id=${context.get('actor').id})`
    return context.json(requireValue(job))
  })
  return routes
}
