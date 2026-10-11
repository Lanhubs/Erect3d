import { useState } from 'react'
import { documentChanges } from '../../../api/client'
import { atPath, downloadDocument } from './changes'
import type { SyncEngine } from './engine'
export function ConflictReview({ engine, close }: { engine: SyncEngine; close: () => void }) {
  const { base, draft, conflict } = engine.record
  const changes = documentChanges(base.document, draft)
  const [selected, setSelected] = useState(() => changes.map(change => JSON.stringify(atPath(base.document, change.path)) === JSON.stringify(atPath(conflict!.document, change.path))))
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  const apply = async (discard = false) => {
    if (discard && !confirm('Discard this device draft and load the server version? Export a copy first if you need it.')) return
    setBusy(true); setError('')
    try { await engine.resolve(discard ? [] : changes.filter((_, index) => selected[index])); if (!engine.record.conflict) close() }
    catch (error) { setError((error as Error).message) } finally { setBusy(false) }
  }
  return <div className="cloud-modal" role="dialog" aria-modal="true" aria-labelledby="conflict-title">
    <div className="cloud-dialog"><header><h2 id="conflict-title">Review revision conflict</h2><button onClick={close} aria-label="Close conflict review">×</button></header>
      <p>Your device started at revision {base.revision}; the server is at {conflict?.revision}. Unchanged server fields are selected below. Select an overlapping field only if you intend to replace it.</p>
      <button onClick={() => downloadDocument(draft)}>Export full device draft</button>
      <div className="cloud-change-list">{changes.map((change, index) => {
        const overlap = JSON.stringify(atPath(base.document, change.path)) !== JSON.stringify(atPath(conflict!.document, change.path))
        return <div key={change.path.join('/')}><label><input type="checkbox" disabled={busy} checked={selected[index]} onChange={e => setSelected(items => items.map((value, i) => i === index ? e.target.checked : value))} />
          {change.action} · {change.path.join(' / ')} {overlap && <strong> · Changed on server</strong>}</label>
          <details><summary>Compare values</summary><pre>{JSON.stringify({ before: atPath(base.document, change.path), server: atPath(conflict!.document, change.path), device: change.action === 'delete' ? '[deleted]' : change.value }, null, 2)}</pre></details></div>
      })}</div>
      {error && <p role="alert">{error}</p>}
      <footer><button className="primary" disabled={busy || !selected.some(Boolean)} onClick={() => void apply()}>Apply {selected.filter(Boolean).length} reviewed changes</button>
        <button disabled={busy} onClick={() => void apply(true)}>Use server version</button></footer>
    </div>
  </div>
}
