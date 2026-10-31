import { Hono } from 'hono'
import { z } from 'zod'
import type { Database } from '../../db/connection'
import type { Config } from '../../config/env'
import type { ApiEnv } from '../../middleware/types'
import type { ObjectStore } from '../../storage/objects'
import { requireStore } from '../../storage/objects'
import { body, param } from '../../contracts/http'
import { revision } from '../../contracts/primitives'
import { authorize } from '../../security/permissions'
import { ApiError, requireValue } from '../../security/errors'
import { idempotent } from '../../security/idempotency'
import { enqueue } from '../../jobs/queue'
import { loadDocument } from '../projects/documents'
import { cadCapabilities } from '../cad/capabilities'
import { projectQuantities } from '../quantities/service'
import type { Project } from '../../../../client/src/domain/types'

const exportRequest = z
  .object({
    format: z.enum(['project-json', 'quantities-json', 'dxf', 'dwg']),
    revision,
    levelId: z.string().min(1).max(60).optional(),
    allLevels: z.boolean().optional(),
  })
  .strict()
type ExportRequest = z.infer<typeof exportRequest>

const isCad = (format: ExportRequest['format']) => format === 'dxf' || format === 'dwg'

/** A sheet for a floor that is not in the drawing would silently export the wrong storey. */
function assertScope(document: Project, input: ExportRequest) {
  if (input.allLevels || !input.levelId) return
  if (!document.buildings[0]?.levels.some((level) => level.id === input.levelId))
    throw new ApiError(422, 'UNKNOWN_LEVEL', 'Select a floor in this building')
}

export function exportRoutes(db: Database, config: Config, store?: ObjectStore) {
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
    const input = await body(context, exportRequest)
    requireStore(store)
    if (input.format === 'dwg' && !(await cadCapabilities(config)).dwgExport)
      throw new ApiError(
        503,
        'DWG_CONVERTER_UNAVAILABLE',
        'DWG needs a server-side converter; DXF opens in the same tools',
      )
    const result = await idempotent(
      db,
      actor.id,
      `export:${projectId}`,
      context.req.header('Idempotency-Key'),
      input,
      async (tx) => {
        await authorize(tx, actor, projectId)
        const snapshot = await loadDocument(tx, projectId, input.revision)
        if (isCad(input.format)) assertScope(snapshot.document, input)
        return {
          jobId: await enqueue(
            tx,
            actor,
            projectId,
            isCad(input.format) ? 'cad.export' : 'export',
            isCad(input.format) ? input : { format: input.format, revision: input.revision },
            context.get('requestId'),
          ),
        }
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
