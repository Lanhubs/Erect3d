import { Hono } from 'hono'
import { z } from 'zod'
import type { Database } from '../../db/connection'
import type { ApiEnv } from '../../middleware/types'
import { param, parse } from '../../contracts/http'
import { authorize } from '../../security/permissions'
export function auditRoutes(db: Database) {
  const routes = new Hono<ApiEnv>()
  routes.get('/:projectId/audit', async (context) => {
    const projectId = param(context, 'projectId')
    await authorize(db, context.get('actor'), projectId, 'manage')
    const query = parse(
      z
        .object({
          cursor: z.coerce.number().int().nonnegative().default(0),
          limit: z.coerce.number().int().min(1).max(100).default(30),
        })
        .strict(),
      context.req.query(),
    )
    const rows =
      await db`SELECT * FROM audit_events WHERE project_id=${projectId} AND id>${query.cursor} ORDER BY id LIMIT ${query.limit + 1}`
    return context.json({
      items: rows.slice(0, query.limit),
      nextCursor: rows.length > query.limit ? rows[query.limit - 1].id : null,
    })
  })
  return routes
}
