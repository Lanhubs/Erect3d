import { z } from 'zod'
import type { Database } from '../../db/connection'
import type { Actor } from '../auth/session'
import { authorize } from '../../security/permissions'
import { ApiError, requireValue } from '../../security/errors'
import { audit } from '../audit/service'

export const collaboratorRole = z.enum(['EDITOR', 'REVIEWER', 'CLIENT', 'VIEWER'])
export const collaboratorEmail = z
  .object({
    email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
    role: collaboratorRole,
  })
  .strict()

export async function grantProjectAccess(
  db: Database,
  actor: Actor,
  projectId: string,
  target: { email: string } | { userId: string },
  role: z.infer<typeof collaboratorRole>,
  requestId: string,
) {
  await db.begin(async (tx) => {
    await tx`SELECT id FROM projects WHERE id=${projectId} FOR UPDATE`
    await authorize(tx, actor, projectId, 'manage')
    // Resolve addresses only after authorization; this is not an account directory.
    const [user] =
      'email' in target
        ? await tx`SELECT id FROM users WHERE email=${target.email}`
        : await tx`SELECT id FROM users WHERE id=${target.userId}`
    if (!user && 'email' in target)
      throw new ApiError(
        422,
        'ACCOUNT_NOT_FOUND',
        'No registered account uses this email. Ask them to register, then add them by email.',
      )
    requireValue(user)
    const [owner] = await tx`SELECT owner_id FROM projects WHERE id=${projectId}`
    if (owner.owner_id === user.id)
      throw new ApiError(409, 'OWNER_TRANSFER_REQUIRED', 'Use ownership transfer for the project owner')
    await tx`INSERT INTO project_members(project_id,user_id,role) VALUES (${projectId},${user.id},${role})
      ON CONFLICT(project_id,user_id) DO UPDATE SET role=EXCLUDED.role`
    await audit(tx, actor, projectId, 'project.role_changed', requestId, { userId: user.id, role })
  })
}
