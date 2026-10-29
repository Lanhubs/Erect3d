import { useCallback, useEffect, useRef, useState } from 'react'
import { api, capabilities } from './api'
import { getTask, putTask } from './cache'
import { subscribeAssistant } from './assistantEvents'
import { subscribeAnalysis } from './analysisEvents'
import { useProject } from '../state/project'
import type { CloudSession } from './useCloudProject'
import type { AssistantRun, AssistantScope, ChatCache, Thread } from './assistantTypes'
import { pendingRun } from './assistantTypes'
import { applyAssistantProposal, finishAssistantApply } from './assistantApply'
import { resolveAssistantFloor } from '../domain/assistantFloor'
import { assistantRequestId } from './assistantDelivery'
import { approvesAssistantProposal } from './assistantIntent'
import { assistantSelection } from '../domain/assistantSelection'
import { assistantStarterRequest, type AssistantStarter } from './assistantStarters'
import { creationScope } from '../domain/assistantCreation'
export function useAssistant(userId: string, projectId: string, session: CloudSession, open: boolean) {
  const key = `${userId}/assistant/${projectId}`,
    path = `/projects/${projectId}/assistant`
  const [thread, setThread] = useState<Thread>({ messages: [], run: null, nextCursor: null }),
    [draft, setDraft] = useState(''),
    [choice, setChoice] = useState<AssistantScope['mode'] | null>(null),
    [targetFloorId, setTargetFloorId] = useState<string | null>(null),
    [attach, setAttach] = useState(false)
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [enabled, setEnabled] = useState<boolean | null>(null),
    [online, setOnline] = useState(navigator.onLine),
    [loaded, setLoaded] = useState(false)
  const latest = useRef({ thread, session })
  latest.current = { thread, session }
  const cached = useRef({ key, loaded, value: { ...thread, draft, choice, attach, targetFloorId } })
  cached.current = { key, loaded, value: { ...thread, draft, choice, attach, targetFloorId } }
  useEffect(
    () => () => {
      const last = cached.current
      if (last.loaded) void putTask(last.key, last.value).catch(() => {})
    },
    [key],
  )
  const project = useProject((s) => s.project),
    activeId = useProject((s) => s.activeLevelId),
    selection = useProject((s) => s.selection),
    readOnly = useProject((s) => s.readOnly),
    dirty = useProject((s) => s.dirty)
  const selected = assistantSelection(project, selection)
  const usingSelection = choice === 'selection' || (!choice && !!selection)
  const building =
      (usingSelection && selected?.building) ||
      project?.buildings.find((b) => b.levels.some((l) => l.id === activeId)) ||
      project?.buildings[0],
    activeLevel =
      (usingSelection && selected?.level) ||
      building?.levels.find((l) => l.id === activeId) ||
      building?.levels[0]
  const previousActive = useRef(activeId)
  useEffect(() => {
    if (previousActive.current !== activeId) setTargetFloorId(null)
    previousActive.current = activeId
  }, [activeId])
  const scopedLevel =
    choice === 'selection' || (!choice && selection)
      ? activeLevel
      : building?.levels.find((level) => level.id === targetFloorId) || activeLevel
  const baseScope: AssistantScope | undefined =
    building && scopedLevel
      ? {
          mode: choice || (selection?.id ? 'selection' : 'level'),
          buildingId: building.id,
          levelId: scopedLevel.id,
          ...(choice === 'selection' || (!choice && selection)
            ? { entityId: selection?.id, floorIndex: selection?.floorIndex }
            : {}),
        }
      : undefined
  const intendedScope = creationScope(project, baseScope, draft)
  const target = building && intendedScope ? resolveAssistantFloor(building, intendedScope, draft) : undefined
  const scope = intendedScope && { ...intendedScope, levelId: target?.levelId || intendedScope.levelId }
  const level = building?.levels.find((level) => level.id === scope?.levelId)
  const referenceName =
    project?.sources.find((source) => source.id === level?.sourceId)?.name || 'this floor’s imported plan'
  const stale =
    thread.run?.status === 'ready' &&
    (thread.run.base_revision !== session.record?.base.revision ||
      dirty ||
      !!session.record?.pending ||
      !!session.record?.conflict ||
      session.state === 'pending')
  const refresh = useCallback(async () => {
    const value = await api.request<Thread>(`${path}/thread`)
    setThread(value)
    if (value.run?.status === 'applied') await finishAssistantApply(latest.current.session, key, value.run)
    return value
  }, [key, path])
  useEffect(() => {
    let alive = true
    getTask<ChatCache>(key)
      .then((cache) => {
        if (alive) {
          if (cache) {
            setThread(cache)
            setDraft(cache.draft)
            setChoice(cache.choice)
            setAttach(cache.attach)
            setTargetFloorId(cache.targetFloorId || null)
          }
          setLoaded(true)
        }
      })
      .catch(() => {
        if (alive) setLoaded(true)
      })
    capabilities()
      .then((c) => {
        if (alive) setEnabled(!!c.assistant)
      })
      .catch(() => {
        if (alive) setEnabled(null)
      })
    return () => {
      alive = false
    }
  }, [key])
  useEffect(() => {
    if (!loaded) return
    const timer = setTimeout(
      () => void putTask(key, { ...thread, draft, choice, attach, targetFloorId }).catch(() => {}),
      200,
    )
    return () => clearTimeout(timer)
  }, [key, loaded, thread, draft, choice, attach, targetFloorId])
  useEffect(() => {
    if (open && loaded && online) void refresh().catch((e) => setError(e.message))
  }, [open, loaded, online, refresh])
  useEffect(() => {
    const connected = () => {
      setOnline(navigator.onLine)
      if (navigator.onLine) void refresh().catch(() => {})
    }
    window.addEventListener('online', connected)
    window.addEventListener('offline', connected)
    const stop = subscribeAssistant(projectId, (event) => {
      if (latest.current.thread.run?.id !== event.runId) return
      setThread((before) => ({
        ...before,
        run: before.run
          ? { ...before.run, progress: event.progress, status: event.status || before.run.status }
          : null,
      }))
      if (event.status && !['queued', 'running'].includes(event.status))
        void refresh().catch((e) => setError(e.message))
    })
    const reconnect = subscribeAnalysis(projectId, (type) => {
      if (type === 'connection.open') void refresh().catch(() => {})
    })
    return () => {
      stop()
      reconnect()
      window.removeEventListener('online', connected)
      window.removeEventListener('offline', connected)
    }
  }, [projectId, refresh])
  const actionPending = useRef(false)
  const action = async (fn: () => Promise<void>) => {
    if (actionPending.current) return
    actionPending.current = true
    setBusy(true)
    setError('')
    try {
      await fn()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      actionPending.current = false
      setBusy(false)
    }
  }
  const send = (request?: { message: string; scope?: AssistantScope; fresh?: boolean }) =>
    action(async () => {
      const message = (request?.message ?? draft).trim()
      const requestScope = request?.scope || scope
      if (!request && approvesAssistantProposal(message, thread.run)) {
        if (stale) throw new Error('The model changed. Prepare a new proposal before applying.')
        await applyAssistantProposal(session, key, projectId, thread.run!)
        if (!request) setDraft('')
        await refresh()
        return
      }
      if (!requestScope || !message || readOnly || !online)
        throw new Error('Connect and choose an editable part of the building first.')
      if (!request?.scope && target?.question) throw new Error(target.question)
      if (requestScope.mode === 'selection' && !requestScope.entityId)
        throw new Error('Select an element or choose This floor.')
      const engine = session.engine
      if (!engine) throw new Error('This project is read only.')
      await engine.sync()
      if (engine.state !== 'saved') throw new Error('Resolve pending edits before sending this request.')
      const previous =
        !request?.fresh &&
        thread.run?.status === 'ready' &&
        thread.run.base_revision === engine.record.base.revision &&
        JSON.stringify(thread.run.scope) === JSON.stringify(requestScope)
          ? thread.run.id
          : undefined
      const input = {
        message,
        scope: requestScope,
        baseRevision: engine.record.base.revision,
        planSourceIds: attach
          ? project?.buildings
              .flatMap((b) => b.levels)
              .filter((l) => l.id === requestScope.levelId && l.sourceId)
              .map((l) => l.sourceId!) || []
          : [],
        previousRunId: previous,
      }
      const old = await getTask<{ input: typeof input; id: string } | null>(`${key}/send`),
        lastMessage = thread.messages.findLast((message) => message.role === 'user')?.content,
        id = assistantRequestId(input, old, thread.run, lastMessage)
      await putTask(`${key}/send`, { input, id })
      try {
        const result = await api.request<{ runId: string }>(`${path}/messages`, 'POST', input, id)
        await putTask(`${key}/send`, null).catch(() => {})
        const run = await api.request<AssistantRun>(`${path}/runs/${result.runId}`)
        setThread((before) => ({ ...before, run }))
        if (requestScope.mode === 'level') setTargetFloorId(requestScope.levelId)
        if (!request) setDraft('')
        await refresh()
      } catch (e) {
        await refresh().catch(() => {})
        throw e
      }
    })
  const cancel = () =>
    action(async () => {
      if (thread.run) {
        await api.request(`${path}/runs/${thread.run.id}/cancel`, 'POST')
        await refresh()
      }
    })
  const apply = () =>
    action(async () => {
      if (thread.run) {
        await applyAssistantProposal(session, key, projectId, thread.run)
        await refresh()
      }
    })
  const older = () =>
    action(async () => {
      if (!thread.nextCursor) return
      const previous = await api.request<Thread>(`${path}/thread?cursor=${thread.nextCursor}`)
      setThread((before) => ({
        ...before,
        messages: [
          ...previous.messages,
          ...before.messages.filter((m) => !previous.messages.some((p) => p.id === m.id)),
        ],
        nextCursor: previous.nextCursor,
      }))
    })
  return {
    thread,
    draft,
    setDraft,
    scope,
    targetFromMessage: scope?.levelId !== baseScope?.levelId,
    chooseScope: (mode: AssistantScope['mode']) => {
      setChoice(mode)
      setTargetFloorId(null)
    },
    attach,
    setAttach,
    level,
    building,
    referenceName,
    selectionName: selected?.name,
    error,
    busy,
    enabled,
    online,
    readOnly,
    stale,
    pending: pendingRun(thread.run),
    send,
    start: (starter: AssistantStarter) => {
      try {
        const request = assistantStarterRequest(project, activeId, starter)
        setChoice('level')
        setTargetFloorId(request.scope.levelId)
        return send(request)
      } catch (e) {
        setError((e as Error).message)
      }
    },
    cancel,
    apply,
    refresh: () =>
      action(async () => {
        await refresh()
      }),
    older,
  }
}
