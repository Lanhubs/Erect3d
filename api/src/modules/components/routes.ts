import { Hono } from 'hono'
import { z } from 'zod'
import type { Database } from '../../db/connection'
import type { ApiEnv } from '../../middleware/types'
import { body,parse } from '../../contracts/http'
import { id,name,pagination } from '../../contracts/primitives'
import { door,windowUnit } from '../../contracts/elements'
import { furniture } from '../../contracts/project'
import { material } from '../../contracts/primitives'
import { authorize,teamPermission } from '../../security/permissions'
import { newId } from '../../security/tokens'
import { ApiError } from '../../security/errors'
export const librarySchema = z.object({
  name,scope:z.enum(['personal','team','project']),teamId:id.optional(),projectId:id.optional(),
  item:z.discriminatedUnion('kind',[
    z.object({ kind:z.literal('material'),data:z.object({ key:material,color:z.string().regex(/^#[a-fA-F0-9]{6}$/),roughness:z.number().min(0).max(1) }).strict() }).strict(),
    z.object({ kind:z.literal('component'),data:z.union([door,windowUnit,furniture]) }).strict(),
  ]),
}).strict().refine(value => value.scope==='personal' ? !value.teamId && !value.projectId :
  value.scope==='team' ? !!value.teamId && !value.projectId : !!value.projectId && !value.teamId,'Scope must match its owner')
export function libraryRoutes(db: Database) {
  const routes = new Hono<ApiEnv>()
  routes.get('/',async context => {
    const actor = context.get('actor'),query = parse(pagination,context.req.query())
    const rows = await db`SELECT l.id,l.kind,l.name,l.data,l.team_id,l.project_id FROM library_items l
      WHERE l.id>${query.cursor || ''} AND (l.owner_id IS NULL OR l.owner_id=${actor.id} AND l.team_id IS NULL AND l.project_id IS NULL
      OR EXISTS(SELECT 1 FROM team_members m WHERE m.team_id=l.team_id AND m.user_id=${actor.id})
      OR EXISTS(SELECT 1 FROM projects p WHERE p.id=l.project_id AND p.deleted_at IS NULL AND (p.team_id IS NULL AND p.owner_id=${actor.id}
        OR EXISTS(SELECT 1 FROM project_members m WHERE m.project_id=p.id AND m.user_id=${actor.id})
        OR EXISTS(SELECT 1 FROM team_members m WHERE m.team_id=p.team_id AND m.user_id=${actor.id})))) ORDER BY l.id LIMIT ${query.limit + 1}`
    return context.json({ items:rows.slice(0,query.limit),nextCursor:rows.length>query.limit?rows[query.limit-1].id:null })
  })
  routes.post('/',async context => {
    const actor = context.get('actor'),input = await body(context,librarySchema)
    if (input.projectId) await authorize(db,actor,input.projectId,'edit')
    if (input.teamId) {
      const role = await teamPermission(db,actor,input.teamId)
      if (!['OWNER','EDITOR'].includes(role)) throw new ApiError(403,'FORBIDDEN','Library editing requires an editor role')
    }
    const [item] = await db`INSERT INTO library_items(id,owner_id,team_id,project_id,kind,name,data)
      VALUES (${newId('library')},${actor.id},${input.teamId ?? null},${input.projectId ?? null},${input.item.kind},${input.name},${input.item.data}::jsonb)
      RETURNING id,kind,name,data`
    return context.json(item,201)
  })
  return routes
}
