import { useEffect, useRef, useState } from 'react'
import { api } from './api'
import { repository, putBlob } from './cache'
import { SyncEngine } from './engine'
import { canEdit, recordKey, type CloudRecord, type SyncState } from './types'
import { useProject } from '../state/project'
import { setCloudPersistence } from '../state/persistenceMode'
import { connectProject, type Peer } from './realtime'
import { loadPrivateSource,syncPrivateSources } from './sources'
import { connectionUnavailable } from './offline'
import type { User } from './account'
import { RemoteError } from '../../../api/client'
import {analysisConnected} from './analysisEvents'
export type CloudSession = { record?: CloudRecord; state: SyncState; secondary: boolean; peers: Peer[]; error: string; engine?: SyncEngine; reviewVersion: number; reserve?: (id: string, release?: boolean) => void }
export function useCloudProject(user: User, projectId: string) {
  const [session, setSession] = useState<CloudSession>({ state: 'pending', secondary: false, peers: [], error: '', reviewVersion: 0 })
  const engineRef = useRef<SyncEngine | undefined>(undefined)
  useEffect(() => {
    let disposed = false, release: (() => void) | undefined, unsubscribe: (() => void) | undefined
    let disconnect: (() => void) | undefined, timer: ReturnType<typeof setInterval> | undefined, applying = false, refreshing = false
    const controller = new AbortController()
    const key = recordKey(user.id, projectId)
    useProject.getState().setProject(null); useProject.getState().setReadOnly(true)
    const fail = (error: unknown) => {
      if (disposed) return
      if (connectionUnavailable(error) && engineRef.current) {setSession(state=>({...state,state:'offline',error:''}));return}
      if (error instanceof RemoteError && [401,403,404].includes(error.status)) useProject.getState().setReadOnly(true)
      setSession(state => ({ ...state, error: (error as Error).message }))
    }
    const display = (engine: SyncEngine, replace = false) => {
      if (disposed) return
      const store = useProject.getState(), document = engine.record.draft
      // Never interrupt a live drag; refresh again after the gesture is committed or cancelled.
      if (replace && !store.previewBase) {
        applying = true; store.adoptDocument(document); applying = false
      }
      store.setReadOnly(!canEdit(engine.record.base))
      setSession(state => ({ ...state, record: structuredClone(engine.record), engine, secondary: false, state: engine.state, error: engine.state==='offline'?'':engine.record.error || '' }))
    }
    const refresh = async () => {
      if (refreshing || disposed || useProject.getState().previewBase) return
      refreshing = true
      try {
        const engine=engineRef.current
        await engine?.refresh(() => !useProject.getState().previewBase)
        if (engine && !disposed && engine.state==='saved' && canEdit(engine.record.base)) await syncPrivateSources(key,projectId,engine.record.base.document.sources)
        if (!disposed) setSession(state => ({ ...state,error:engine?.record.error || '',reviewVersion: state.reviewVersion + 1 }))
      }
      catch (error) { fail(error) } finally { refreshing = false }
    }
    const start = async (writer: boolean) => {
      const cached = await repository.get(key)
      let record: CloudRecord
      try {
        const snapshot = await api.load(projectId)
        record = cached ? { ...cached, base: { ...cached.base, role: snapshot.role, allowClientApproval: snapshot.allowClientApproval } }
          : { key, userId: user.id, base: snapshot, draft: snapshot.document }
      } catch (error) { if (!connectionUnavailable(error) || !cached) throw error; record = cached }
      if (disposed) return
      if (!writer) {
        setCloudPersistence({ projectId, save: async () => { throw new Error('This project is being edited in another tab.') },
          saveSource: async () => { throw new Error('This project is read only.') }, loadSource: id => loadPrivateSource(key, projectId, id) })
        useProject.getState().setProject(record.base.document)
        setSession(state => ({ ...state, record, state: 'saved', secondary: true }))
        timer = setInterval(() => { api.load(projectId).then(snapshot => {
          if (disposed) return
          useProject.getState().setProject(snapshot.document)
          setSession(state => ({ ...state, record: { ...record, base: snapshot, draft: snapshot.document }, reviewVersion: state.reviewVersion + 1 }))
        }).catch(fail) }, 10000)
        return
      }
      const engine = new SyncEngine(record, repository, api, display); engineRef.current = engine
      clearInterval(timer)
      applying = true; useProject.getState().setProject(record.draft); applying = false
      display(engine)
      setCloudPersistence({ projectId, save: project => engine.stage(project),
        saveSource: (id, blob) => putBlob(key, id, blob), loadSource: id => loadPrivateSource(key, projectId, id) })
      unsubscribe = useProject.subscribe((next, before) => {
        if (!applying && next.project?.id === projectId && next.version !== before.version && !next.previewBase) {
          const version = next.version
          void engine.stage(next.project).then(() => {useProject.getState().markSaved(version);void refresh()}).catch(fail)
        }
      })
      const realtime = connectProject(projectId, () => engine.record.base.revision, () => { void refresh() }, peers => {
        if (!disposed) setSession(state => ({ ...state, peers }))
      }, message => fail(new Error(message)))
      disconnect = realtime.close; setSession(state => ({ ...state, reserve: realtime.reserve }))
      timer = setInterval(() => { if(!analysisConnected(projectId) && document.visibilityState!=='hidden')void refresh() }, 30000)
      window.addEventListener('online', refresh)
      await refresh()
    }
    if (!navigator.locks) fail(new Error('Cloud editing requires HTTPS and Web Locks support.'))
    else void navigator.locks.request(`erect-cloud-project:${key}`, { ifAvailable: true }, async lock => {
      try {
        await start(Boolean(lock))
        const hold = () => new Promise<void>(resolve => { release = resolve })
        if (lock && !disposed) await hold()
        else if (!disposed) await navigator.locks.request(`erect-cloud-project:${key}`, { signal: controller.signal }, async () => {
          if (!disposed) { await start(true); if (!disposed) await hold() }
        })
      } catch (error) { fail(error) }
    })
    return () => {
      disposed = true; controller.abort(); unsubscribe?.(); disconnect?.(); clearInterval(timer); window.removeEventListener('online', refresh)
      const engine = engineRef.current; engineRef.current = undefined
      void (engine?.flush() || Promise.resolve()).finally(() => { engine?.stop(); release?.() })
      setCloudPersistence()
      useProject.getState().setReadOnly(false); useProject.getState().setProject(null)
    }
  }, [user.id, projectId])
  return session
}
