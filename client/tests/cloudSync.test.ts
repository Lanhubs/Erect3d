import { expect, test } from 'bun:test'
import { SyncEngine } from '../src/cloud/engine'
import { atPath, patch } from '../src/cloud/changes'
import { documentChanges, RemoteError, type Operation, type Snapshot } from '../../api/client'
import { fixtureProject } from '../src/domain/fixture'
import type { CloudRecord, CloudRepository } from '../src/cloud/types'
const snapshot = (): Snapshot => ({ schemaVersion: 1, projectId: 'project_cloud', revision: 0,
  document: { ...fixtureProject('Original'), id: 'project_cloud' }, checksum: 'test', role: 'OWNER' })
class MemoryRepository implements CloudRepository {
  value?: CloudRecord; fail = false
  async get() { return structuredClone(this.value) }
  async put(record: CloudRecord) { if (this.fail) throw new Error('Disk full'); this.value = structuredClone(record) }
}
function setup() {
  let remote = snapshot(), calls: Operation[] = [], offline = false, loseResponse = false
  const accepted = new Map<string, Operation & { revision: number; actorId: string; modifiedAt: number }>()
  const transport = {
    load: async () => { if (offline) throw new TypeError('offline'); return structuredClone(remote) },
    apply: async (_id: string, operation: Operation) => {
      calls.push(structuredClone(operation))
      if (offline) throw new TypeError('offline')
      if (accepted.has(operation.operationId)) return accepted.get(operation.operationId)!
      if (operation.baseRevision !== remote.revision) throw new RemoteError(409, 'REVISION_CONFLICT', 'Review the server revision')
      const result = { ...operation, revision: remote.revision + 1, actorId: 'user_a', modifiedAt: Date.now() }
      remote = { ...remote, document: patch(remote.document, operation.payload.changes), revision: result.revision }
      accepted.set(operation.operationId, result)
      if (loseResponse) { loseResponse = false; throw new TypeError('response lost') }
      return result
    },
  }
  const repo = new MemoryRepository(), record = { key: 'user_a/project_cloud', userId: 'user_a', base: remote, draft: remote.document }
  const engine = new SyncEngine(record, repo, transport, () => {})
  return { engine, repo, transport, calls, get remote() { return remote }, set remote(value: Snapshot) { remote = value },
    set offline(value: boolean) { offline = value }, set loseResponse(value: boolean) { loseResponse = value } }
}
test('offline edits survive reload and replay the same frozen operation body', async () => {
  const context = setup(); context.offline = true
  await context.engine.stage({ ...context.engine.record.draft, name: 'Device edit' }); await context.engine.sync()
  expect(context.engine.state).toBe('offline'); expect(context.repo.value?.draft.name).toBe('Device edit')
  const frozen = structuredClone(context.repo.value!.pending!.operation)
  context.engine.stop(); context.offline = false
  const restored = new SyncEngine(context.repo.value!, context.repo, context.transport, () => {})
  await restored.refresh()
  expect(context.calls.at(-1)).toEqual(frozen); expect(context.remote.document.name).toBe('Device edit')
  expect(restored.state).toBe('saved'); expect(restored.record.base.revision).toBe(1)
})
test('an accepted save with a lost response is retried idempotently before refreshing', async () => {
  const context = setup(); context.loseResponse = true
  await context.engine.stage({ ...context.engine.record.draft, name: 'Saved remotely' }); await context.engine.sync()
  expect(context.remote.revision).toBe(1); expect(context.engine.record.pending).toBeDefined()
  const restored = new SyncEngine(context.repo.value!, context.repo, context.transport, () => {})
  await restored.refresh()
  expect(context.calls[1]).toEqual(context.calls[0]); expect(context.remote.revision).toBe(1)
  expect(restored.record.conflict).toBeUndefined(); expect(restored.record.pending).toBeUndefined()
})
test('edits arriving during a save are retained and sent at the next accepted revision', async () => {
  const context = setup(), original = context.transport.apply
  let release!: () => void, started!: () => void
  const begun = new Promise<void>(resolve => { started = resolve }), gate = new Promise<void>(resolve => { release = resolve })
  let first = true
  context.transport.apply = async (id, operation) => { if (first) { first = false; started(); await gate }; return original(id, operation) }
  await context.engine.stage({ ...context.engine.record.draft, name: 'First edit' }); await begun
  await context.engine.stage({ ...context.engine.record.draft, name: 'Latest edit' }); release(); await context.engine.sync()
  expect(context.remote.document.name).toBe('Latest edit'); expect(context.calls.map(call => call.baseRevision)).toEqual([0, 1])
  expect(context.engine.record.draft.name).toBe('Latest edit')
})
test('remote conflicts keep the full draft until selected changes are explicitly rebased', async () => {
  const context = setup()
  context.remote = { ...context.remote, revision: 1, document: { ...context.remote.document, name: 'Collaborator name', units: 'mm' } }
  await context.engine.stage({ ...context.engine.record.draft, name: 'Device name' }); await context.engine.sync()
  expect(context.engine.state).toBe('conflict'); expect(context.engine.record.draft.name).toBe('Device name')
  expect(atPath(context.engine.record.conflict!.document, ['name'])).toBe('Collaborator name')
  await context.engine.resolve(documentChanges(context.engine.record.base.document, context.engine.record.draft))
  expect(context.remote.document.name).toBe('Device name'); expect(context.remote.document.units).toBe('mm')
  expect(context.calls.at(-1)?.operationId).not.toBe(context.calls[0].operationId)
})
test('another remote edit during conflict review requires reviewing the updated revision', async () => {
  const context = setup(); context.remote = { ...context.remote, revision: 1 }
  await context.engine.stage({ ...context.engine.record.draft, name: 'Keep me' }); await context.engine.sync()
  context.remote = { ...context.remote, revision: 2 }
  await expect(context.engine.resolve([])).rejects.toThrow('changed again')
  expect(context.engine.record.draft.name).toBe('Keep me'); expect(context.engine.record.conflict?.revision).toBe(2)
  await context.engine.resolve([]); expect(context.engine.record.draft.name).toBe('Original')
})
test('a failed durable queue write never sends an unstored operation', async () => {
  const context = setup(); context.repo.fail = true
  await expect(context.engine.stage({ ...context.engine.record.draft, name: 'Unsaved' })).rejects.toThrow('Disk full')
  expect(context.calls).toHaveLength(0); expect(context.engine.record.draft.name).toBe('Unsaved')
})
test('viewer drafts cannot mutate, and remote restores recover through snapshots', async () => {
  const context = setup(); context.engine.record.base.role = 'VIEWER'
  await expect(context.engine.stage({ ...context.engine.record.draft, name: 'Forbidden' })).rejects.toThrow('read only')
  context.remote = { ...context.remote, role: 'VIEWER', revision: 2, document: { ...context.remote.document, name: 'Restored version' } }
  await context.engine.refresh(); expect(context.engine.record.draft.name).toBe('Restored version')
  expect(context.calls).toHaveLength(0)
})
test('remote snapshots are deferred during an active gesture', async () => {
  const context = setup(); context.remote = { ...context.remote, revision: 1, document: { ...context.remote.document, name: 'Other edit' } }
  await context.engine.refresh(() => false); expect(context.engine.record.base.revision).toBe(0)
  await context.engine.refresh(); expect(context.engine.record.draft.name).toBe('Other edit')
})
