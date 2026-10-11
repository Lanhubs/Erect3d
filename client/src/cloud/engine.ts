import { documentChanges, RemoteError, type ErectApi, type Project, type Snapshot } from '../../../api/client'
import type { CloudRecord, CloudRepository, SyncState } from './types'
import { canEdit } from './types'
import { patch, type Change } from './changes'
type Transport = Pick<ErectApi, 'load' | 'apply'>
export class SyncEngine {
  record: CloudRecord
  state: SyncState = 'saved'
  private repo: CloudRepository; private remote: Transport; private notify: (engine: SyncEngine, replace: boolean) => void
  private serial: Promise<unknown> = Promise.resolve(); private pumping?: Promise<void>; private stopped = false
  constructor(record: CloudRecord, repo: CloudRepository, remote: Transport, notify: (engine: SyncEngine, replace: boolean) => void) {
    this.record = structuredClone(record); this.repo = repo; this.remote = remote; this.notify = notify
    this.state = record.conflict ? 'conflict' : record.pending || documentChanges(record.base.document, record.draft).length ? 'pending' : 'saved'
  }
  private exclusive<T>(action: () => Promise<T>): Promise<T> {
    const task = this.serial.then(action); this.serial = task.catch(() => {}); return task
  }
  private async persist(replace = false) { await this.repo.put(structuredClone(this.record)); this.notify(this, replace) }
  async stage(draft: Project) {
    await this.exclusive(async () => {
      if (this.stopped || !canEdit(this.record.base)) throw new Error('This cloud project is read only.')
      this.record.draft = structuredClone(draft)
      if (!this.record.conflict) { this.record.error = undefined; this.state = 'pending' }
      await this.persist()
    })
    void this.sync().catch(error => { this.record.error = (error as Error).message; this.state = 'blocked'; this.notify(this, false) })
  }
  sync(): Promise<void> {
    if (this.pumping) return this.pumping
    this.pumping = this.pump().finally(() => { this.pumping = undefined })
    return this.pumping
  }
  private async pump() {
    try {
      while (!this.stopped) {
        const pending = await this.exclusive(async () => {
          if (this.record.conflict || !canEdit(this.record.base)) return undefined
          if (!this.record.pending) {
            const changes = documentChanges(this.record.base.document, this.record.draft)
            if (!changes.length) { this.state = 'saved'; await this.persist(); return undefined }
            if (changes.length > 512) throw new Error('This edit exceeds 512 changes. Export your draft and reduce this edit before syncing.')
            const operation = { operationId: crypto.randomUUID(), baseRevision: this.record.base.revision,
              type: 'document.patch' as const, entityId: this.record.draft.id, payload: { changes } }
            if (new Blob([JSON.stringify(operation)]).size > 2 * 1024 * 1024) throw new Error('This edit exceeds the 2 MB transaction limit. Export your draft and reduce this edit.')
            this.record.pending = { operation, after: structuredClone(this.record.draft) }
          }
          this.state = 'syncing'; await this.persist()
          return structuredClone(this.record.pending)
        })
        if (!pending || this.stopped) return
        // The persisted ID and body are immutable, including after an unknown network outcome.
        const accepted = await this.remote.apply(this.record.base.projectId, pending.operation)
        await this.exclusive(async () => {
          this.record.base = { ...this.record.base, revision: accepted.revision,
            document: { ...pending.after, modified: accepted.modifiedAt } }
          this.record.pending = undefined; this.record.error = undefined
          await this.persist()
        })
      }
    } catch (error) {
      if (this.stopped) return
      if (error instanceof RemoteError && error.status === 409) {
        try {
          const snapshot = await this.remote.load(this.record.base.projectId)
          await this.exclusive(async () => { this.record.conflict = snapshot; this.state = 'conflict'; this.record.error = error.message; await this.persist() })
          return
        } catch { /* Preserve the frozen operation until connectivity returns. */ }
      }
      await this.exclusive(async () => {
        if (error instanceof RemoteError && [400,422].includes(error.status)) this.record.pending = undefined
        this.state = error instanceof RemoteError && error.status < 500 || !(error instanceof RemoteError) && !(error instanceof TypeError) ? 'blocked' : 'offline'
        this.record.error = (error as Error).message; await this.persist()
      })
    }
  }
  async refresh(canAdopt: () => boolean = () => true) {
    if (this.stopped) return
    // Replay an uncertain operation before examining a new snapshot.
    await this.sync()
    if (this.record.pending || this.stopped || this.record.conflict) return
    const snapshot = await this.remote.load(this.record.base.projectId)
    await this.exclusive(async () => {
      if (this.record.pending || this.stopped || !canAdopt()) return
      if (snapshot.revision !== this.record.base.revision) {
        if (documentChanges(this.record.base.document, this.record.draft).length) {
          this.record.conflict = snapshot; this.state = 'conflict'
        } else { this.record.base = snapshot; this.record.draft = snapshot.document; this.state = 'saved' }
      } else this.record.base = { ...this.record.base, role: snapshot.role, allowClientApproval: snapshot.allowClientApproval }
      await this.persist(!this.record.conflict)
    })
  }
  async resolve(changes: Change[]) {
    if (!this.record.conflict) throw new Error('No conflict to review')
    const latest = await this.remote.load(this.record.base.projectId)
    if (latest.revision !== this.record.conflict.revision) {
      await this.exclusive(async () => { this.record.conflict = latest; await this.persist() })
      throw new Error('The remote project changed again. Review the updated changes before applying.')
    }
    await this.exclusive(async () => {
      const draft = patch(latest.document, changes)
      this.record = { ...this.record, base: latest, draft, pending: undefined, conflict: undefined, error: undefined }
      this.state = 'pending'; await this.persist(true)
    })
    await this.sync()
  }
  async adopt(snapshot: Snapshot) {
    await this.exclusive(async () => {
      if (this.record.pending || documentChanges(this.record.base.document, this.record.draft).length) throw new Error('Sync or review pending edits first.')
      this.record.base = snapshot; this.record.draft = snapshot.document; this.state = 'saved'; await this.persist(true)
    })
  }
  async flush() { await this.serial }
  stop() { this.stopped = true }
}
