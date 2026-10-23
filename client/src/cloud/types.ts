import type { Operation, Project, Snapshot } from '../../../api/client'
export type Pending = { operation: Operation; after: Project }
export type CloudRecord = {
  key: string
  userId: string
  base: Snapshot
  draft: Project
  pending?: Pending
  conflict?: Snapshot
  error?: string
}
export type CloudRepository = {
  get: (key: string) => Promise<CloudRecord | undefined>
  put: (record: CloudRecord) => Promise<void>
}
export type SyncState = 'saved' | 'pending' | 'syncing' | 'offline' | 'conflict' | 'blocked'
export const recordKey = (userId: string, projectId: string) => `${userId}/${projectId}`
export const canEdit = (snapshot: Snapshot) => ['OWNER', 'EDITOR'].includes(snapshot.role || '')
