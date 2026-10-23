import type { Database } from '../db/connection'
import type { Actor } from '../modules/auth/session'
import { ApiError } from './errors'
export type Role = 'OWNER' | 'EDITOR' | 'REVIEWER' | 'CLIENT' | 'VIEWER'
export type Action = 'view' | 'edit' | 'review' | 'approve' | 'manage'
export const permissions: Record<Role, readonly Action[]> = {
  OWNER: ['view', 'edit', 'review', 'approve', 'manage'],
  EDITOR: ['view', 'edit', 'review'],
  REVIEWER: ['view', 'review'],
  CLIENT: ['view', 'review', 'approve'],
  VIEWER: ['view'],
}
export async function authorize(
  db: Database,
  actor: Actor,
  projectId: string,
  action: Action = 'view',
  deleted = false,
) {
  const [row] = await db`SELECT p.*,CASE WHEN p.team_id IS NULL AND p.owner_id=${actor.id} THEN 'OWNER'
    WHEN tm.role='OWNER' THEN 'OWNER'
    ELSE COALESCE(pm.role,tm.role) END AS role FROM projects p
    LEFT JOIN project_members pm ON pm.project_id=p.id AND pm.user_id=${actor.id}
    LEFT JOIN team_members tm ON tm.team_id=p.team_id AND tm.user_id=${actor.id}
    WHERE p.id=${projectId} AND (${deleted} OR p.deleted_at IS NULL)`
  if (!row || !row.role) throw new ApiError(404, 'NOT_FOUND', 'Project not found')
  const role = row.role as Role
  if (
    !permissions[role]?.includes(action) ||
    (action === 'approve' && role === 'CLIENT' && !row.allow_client_approval)
  ) {
    throw new ApiError(403, 'FORBIDDEN', 'Your project role does not permit this action')
  }
  return row as {
    id: string
    name: string
    revision: number
    role: Role
    team_id: string | null
    allow_client_approval: boolean
    deleted_at: Date | null
  }
}
export async function teamPermission(db: Database, actor: Actor, teamId: string, ownerOnly = false) {
  const [row] = await db`SELECT role FROM team_members WHERE team_id=${teamId} AND user_id=${actor.id}`
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Team not found')
  if (ownerOnly && row.role !== 'OWNER')
    throw new ApiError(403, 'FORBIDDEN', 'Team owner permission required')
  return row.role as Role
}
