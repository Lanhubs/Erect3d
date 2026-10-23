import { Hono } from 'hono'
import type { Database } from '../../db/connection'
import type { ApiEnv } from '../../middleware/types'
import { body, param, parse } from '../../contracts/http'
import { pagination } from '../../contracts/primitives'
import { presentationSchema, savedViewSchema } from '../../contracts/review'
import { authorize } from '../../security/permissions'
import { newId } from '../../security/tokens'
import { ApiError } from '../../security/errors'
import { loadDocument } from '../projects/documents'
export function presentationRoutes(db: Database) {
  const routes = new Hono<ApiEnv>()
  routes.get('/:projectId/views', async (context) => {
    const projectId = param(context, 'projectId')
    await authorize(db, context.get('actor'), projectId)
    const query = parse(pagination, context.req.query())
    return context.json(
      await db`SELECT id,name,data,created_at FROM saved_views WHERE project_id=${projectId} AND id>${query.cursor || ''} ORDER BY id LIMIT ${query.limit}`,
    )
  })
  routes.post('/:projectId/views', async (context) => {
    const input = await body(context, savedViewSchema),
      projectId = param(context, 'projectId'),
      actor = context.get('actor')
    const view = await db.begin(async (tx) => {
      await tx`SELECT id FROM projects WHERE id=${projectId} FOR UPDATE`
      await authorize(tx, actor, projectId, 'edit')
      const { document } = await loadDocument(tx, projectId)
      if (!document.buildings.some((building) => building.levels.some((level) => level.id === input.levelId)))
        throw new ApiError(422, 'INVALID_LEVEL', 'View level is not part of this project')
      const [row] = await tx`INSERT INTO saved_views(id,project_id,actor_id,name,data)
        VALUES (${newId('view')},${projectId},${actor.id},${input.name},${input}::jsonb) RETURNING id,name,data`
      return row
    })
    return context.json(view, 201)
  })
  routes.delete('/:projectId/views/:viewId', async (context) => {
    const projectId = param(context, 'projectId'),
      viewId = param(context, 'viewId')
    await db.begin(async (tx) => {
      await tx`SELECT id FROM projects WHERE id=${projectId} FOR UPDATE`
      await authorize(tx, context.get('actor'), projectId, 'edit')
      const [presentation] =
        await tx`SELECT 1 FROM presentations WHERE project_id=${projectId} AND data @> ${{ viewIds: [viewId] }}::jsonb LIMIT 1`
      if (presentation) throw new ApiError(409, 'VIEW_IN_USE', 'View is referenced by a saved presentation')
      await tx`DELETE FROM saved_views WHERE id=${viewId} AND project_id=${projectId}`
    })
    return context.body(null, 204)
  })
  routes.get('/:projectId/presentations', async (context) => {
    const projectId = param(context, 'projectId')
    await authorize(db, context.get('actor'), projectId)
    const query = parse(pagination, context.req.query())
    return context.json(
      await db`SELECT id,name,data,created_at FROM presentations WHERE project_id=${projectId} AND id>${query.cursor || ''} ORDER BY id LIMIT ${query.limit}`,
    )
  })
  routes.post('/:projectId/presentations', async (context) => {
    const input = await body(context, presentationSchema),
      projectId = param(context, 'projectId'),
      actor = context.get('actor')
    const result = await db.begin(async (tx) => {
      await tx`SELECT id FROM projects WHERE id=${projectId} FOR UPDATE`
      await authorize(tx, actor, projectId, 'edit')
      for (const viewId of input.viewIds) {
        const [view] = await tx`SELECT 1 FROM saved_views WHERE id=${viewId} AND project_id=${projectId}`
        if (!view) throw new ApiError(422, 'INVALID_VIEW', 'View is not part of this project')
      }
      if (input.versionId) {
        const [version] =
          await tx`SELECT 1 FROM versions WHERE id=${input.versionId} AND project_id=${projectId}`
        if (!version) throw new ApiError(422, 'INVALID_VERSION', 'Version is not part of this project')
      }
      const [row] = await tx`INSERT INTO presentations(id,project_id,actor_id,name,data)
        VALUES (${newId('presentation')},${projectId},${actor.id},${input.name},${input}::jsonb) RETURNING id,name,data`
      return row
    })
    return context.json(result, 201)
  })
  return routes
}
