import { useEffect, useState } from 'react'
import { api, paginated } from './api'
import { useAccount } from './account'
import { useProject } from '../state/project'
import type { CloudSession } from './useCloudProject'
type Member = { id: string; name: string; role: string }
type Comment = { id: string; text: string; actor_id: string; resolved_at?: string; anchor: { entityId?: string; levelId?: string } }
export function CollaborationPanel({ session }: { session: CloudSession }) {
  const record = session.record!, user = useAccount(state => state.user)!, selection = useProject(state => state.selection)
  const levelId = useProject(state => state.activeLevelId), readOnly = useProject(state => state.readOnly)
  const [members, setMembers] = useState<Member[]>([]), [comments, setComments] = useState<Comment[]>([])
  const [accountId, setAccountId] = useState(''), [role, setRole] = useState('VIEWER'), [text, setText] = useState('')
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [reservation, setReservation] = useState('')
  const manage = !session.secondary && record.base.role === 'OWNER'
  const review = !session.secondary && ['OWNER', 'EDITOR', 'REVIEWER', 'CLIENT'].includes(record.base.role || '')
  const path = `/projects/${record.base.projectId}`
  const refresh = async () => {
    const people: Member[] = []; let cursor = ''
    for (;;) {
      const page = await api.request<Member[]>(`${path}/members?limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`)
      people.push(...page); if (page.length < 100) break; cursor = page.at(-1)!.id
    }
    const discussion = await paginated<Comment>(`${path}/comments`)
    setMembers(people); setComments(discussion)
  }
  useEffect(() => { let alive = true; refresh().catch(error => { if (alive) setError(error.message) }); return () => { alive = false } }, [path, session.reviewVersion])
  const run = async (action: () => Promise<unknown>) => {
    setBusy(true); setError('')
    try { await action(); await refresh() } catch (error) { setError((error as Error).message) } finally { setBusy(false) }
  }
  return <section aria-label="Project collaboration"><h3>People and access</h3>
    <p>Your account ID: <code>{user.id}</code> <button onClick={() => { void navigator.clipboard.writeText(user.id).catch(error => setError(error.message)) }}>Copy ID</button></p>
    <p>Your effective role: {record.base.role}. Project owners and inherited team access are included in your effective role.</p>
    <ul>{members.map(member => <li key={member.id}>{member.name} · {member.role}
      {manage && <><select aria-label={`Role for ${member.name}`} value={member.role} disabled={busy} onChange={e => void run(() => api.request(`${path}/members/${member.id}`, 'PUT', { role: e.target.value }))}>
        {['EDITOR','REVIEWER','CLIENT','VIEWER'].map(role => <option key={role}>{role}</option>)}
      </select><button disabled={busy} onClick={() => { if (confirm(`Remove ${member.name}'s direct project access?`)) void run(() => api.request(`${path}/members/${member.id}`, 'DELETE')) }}>Remove</button></>}
    </li>)}</ul>
    {manage && <div className="cloud-inline"><label>Existing account ID<input value={accountId} maxLength={128} onChange={e => setAccountId(e.target.value)} /></label>
      <select aria-label="New collaborator role" value={role} onChange={e => setRole(e.target.value)}>{['EDITOR','REVIEWER','CLIENT','VIEWER'].map(role => <option key={role}>{role}</option>)}</select>
      <button disabled={busy || !accountId.trim()} onClick={() => void run(() => api.request(`${path}/members/${encodeURIComponent(accountId.trim())}`, 'PUT', { role }))}>Grant access</button></div>}
    <h3>Live collaborators</h3><p>{session.peers.length ? session.peers.map(peer => `${members.find(member => member.id === peer.userId)?.name || peer.userId}${peer.presence.editingEntityId ? ' · editing a reserved element' : ''}`).join(', ') : 'No other connected collaborators.'}</p>
    {session.reserve && !readOnly && <div className="cloud-inline"><button disabled={!selection} onClick={() => {
      try { session.reserve?.(selection!.id); setReservation(selection!.id); setError('') } catch (error) { setError((error as Error).message) }
    }}>Reserve selected element</button><button disabled={!reservation} onClick={() => {
      try { session.reserve?.(reservation, true); setReservation('') } catch (error) { setError((error as Error).message) }
    }}>Release reservation</button><small>Reservations last 30 seconds and renew while connected. Server conflicts report unavailable elements.</small></div>}
    <h3>Review discussion</h3>
    {review && <form onSubmit={e => { e.preventDefault(); void run(async () => {
      await api.request(`${path}/comments`, 'POST', { text, anchor: { levelId: levelId || undefined, entityId: selection?.id }, mentions: [] }); setText('')
    }) }}><label>Comment on {selection ? 'selected element' : 'active level'}<textarea required maxLength={10000} value={text} onChange={e => setText(e.target.value)} /></label><button disabled={busy || !text.trim()}>Add review comment</button></form>}
    {comments.map(comment => <article className="cloud-comment" key={comment.id}><p>{comment.text}</p><small>{comment.resolved_at ? 'Resolved' : 'Open'} · {comment.anchor.entityId || comment.anchor.levelId || 'Project'}</small>
      {review && <button disabled={busy} onClick={() => void run(() => api.request(`${path}/comments/${comment.id}`, 'PATCH', { resolved: !comment.resolved_at }))}>{comment.resolved_at ? 'Reopen' : 'Resolve'}</button>}
    </article>)}{error && <p role="alert" className="error">{error}</p>}
  </section>
}
