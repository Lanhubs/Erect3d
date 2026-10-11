import { Hono } from 'hono'
import type { Database } from '../../db/connection'
import type { ApiEnv } from '../../middleware/types'
import { body, param, parse } from '../../contracts/http'
import { pagination } from '../../contracts/primitives'
import { approvalSchema } from '../../contracts/review'
import { authorize } from '../../security/permissions'
import { ApiError } from '../../security/errors'
import { newId } from '../../security/tokens'
import { audit, emit } from '../audit/service'
import { loadDocument } from '../projects/documents'
export function approvalRoutes(db: Database) {
  const routes = new Hono<ApiEnv>()
  routes.get('/:projectId/approvals', async context => {
    const projectId = param(context, 'projectId')
    await authorize(db, context.get('actor'), projectId)
    const query = parse(pagination, context.req.query())
    return context.json(await db`SELECT * FROM approvals WHERE project_id=${projectId} AND id>${query.cursor || ''} ORDER BY id LIMIT ${query.limit}`)
  })
  routes.post('/:projectId/approvals', async context => {
    const input = await body(context, approvalSchema), projectId = param(context, 'projectId'), actor = context.get('actor')
    const approval = await db.begin(async tx => {
      await tx`SELECT id FROM projects WHERE id=${projectId} FOR UPDATE`
      const project = await authorize(tx, actor, projectId, 'approve')
      let revision = Number(project.revision)
      if (input.versionId) {
        const [version] = await tx`SELECT revision FROM versions WHERE project_id=${projectId} AND id=${input.versionId}`
        if (!version) throw new ApiError(422, 'INVALID_TARGET', 'Version is not part of this project')
        revision = Number(version.revision)
      }
      if (input.presentationId) {
        const [presentation] = await tx`SELECT data FROM presentations WHERE project_id=${projectId} AND id=${input.presentationId}`
        if (!presentation) throw new ApiError(422, 'INVALID_TARGET', 'Presentation is not part of this project')
        if (presentation.data.versionId) {
          const [version] = await tx`SELECT revision FROM versions WHERE project_id=${projectId} AND id=${presentation.data.versionId}`
          if (!version) throw new ApiError(422,'INVALID_TARGET','Presentation version is unavailable')
          revision = Number(version.revision)
        }
      }
      if (input.levelId) {
        const { document } = await loadDocument(tx, projectId)
        if (!document.buildings.some(building => building.levels.some(level => level.id === input.levelId))) throw new ApiError(422, 'INVALID_TARGET', 'Level is not part of this project')
      }
      if (input.baseRevision !== undefined && input.baseRevision !== revision) {
        throw new ApiError(409,'REVISION_CONFLICT','The approval target changed; review the newer state')
      }
      const [row] = await tx`INSERT INTO approvals(id,project_id,actor_id,version_id,level_id,presentation_id,decision,note,project_revision)
        VALUES (${newId('approval')},${projectId},${actor.id},${input.versionId ?? null},${input.levelId ?? null},${input.presentationId ?? null},${input.decision},${input.note},${revision}) RETURNING *`
      await audit(tx, actor, projectId, 'approval.recorded', context.get('requestId'), { approvalId: row.id, decision: input.decision })
      await emit(tx, projectId, 'approval.created', row)
      return row
    })
    return context.json(approval, 201)
  })
  return routes
}
