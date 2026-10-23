import { api } from './api'
import { useProject } from '../state/project'
import { analysisEvent } from './analysisEvents'
import { assistantEvent } from './assistantEvents'
export type Peer = {
  userId: string
  connectionId: string
  presence: { activeLevelId?: string; selection?: string[]; editingEntityId?: string }
  time: number
}
export function connectProject(
  projectId: string,
  revision: () => number,
  changed: () => void,
  peers: (items: Peer[]) => void,
  error: (message: string) => void,
) {
  let socket: WebSocket | undefined,
    stopped = false,
    retry: ReturnType<typeof setTimeout> | undefined
  let delay = 1000
  let reserved: string | undefined
  const reserve = (entityId: string, release = false) => {
    if (socket?.readyState !== WebSocket.OPEN)
      throw new Error('Collaboration is reconnecting. Retry when connected.')
    if (reserved && reserved !== entityId)
      socket.send(JSON.stringify({ type: 'lock.release', entityId: reserved }))
    socket.send(JSON.stringify({ type: release ? 'lock.release' : 'lock.acquire', entityId }))
    reserved = release ? undefined : entityId
  }
  const people = new Map<string, Peer>()
  const presence = () => {
    const state = useProject.getState()
    if (socket?.readyState === WebSocket.OPEN)
      socket.send(
        JSON.stringify({
          type: 'presence.update',
          presence: {
            activeLevelId: state.activeLevelId || undefined,
            selection: state.selection ? [state.selection.id] : [],
            editingEntityId: reserved,
          },
        }),
      )
  }
  const connect = () => {
    if (stopped) return
    socket = new WebSocket(api.collaborationUrl(projectId, revision()))
    socket.onopen = () => {
      delay = 1000
      analysisEvent(projectId, 'connection.open')
      presence()
      changed()
    }
    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data)
        if (message.type === 'ping') socket?.send(JSON.stringify({ type: 'pong' }))
        else if (message.type === 'presence.update') {
          people.set(message.connectionId, { ...message, time: Date.now() })
          peers([...people.values()])
        } else if (message.type === 'error') {
          error(message.error?.message || 'Collaboration request failed')
          reserved = undefined
          socket?.close()
          changed()
        } else if (message.type?.startsWith('analysis.'))
          analysisEvent(projectId, message.type, message.payload)
        else if (message.type === 'assistant.progress') assistantEvent(projectId, message.payload)
        else if (['operation.accepted', 'revision.restored'].includes(message.type)) changed()
      } catch {
        socket?.close()
      }
    }
    socket.onclose = () => {
      analysisEvent(projectId, 'connection.close')
      people.clear()
      peers([])
      reserved = undefined
      if (!stopped) {
        retry = setTimeout(connect, delay)
        delay = Math.min(delay * 2, 30000)
      }
    }
    socket.onerror = () => socket?.close()
  }
  const timer = setInterval(() => {
    presence()
    if (reserved && socket?.readyState === WebSocket.OPEN)
      socket.send(JSON.stringify({ type: 'lock.acquire', entityId: reserved }))
    for (const [key, person] of people) if (Date.now() - person.time > 30000) people.delete(key)
    peers([...people.values()])
  }, 10000)
  const unsubscribe = useProject.subscribe((next, before) => {
    if (next.activeLevelId !== before.activeLevelId || next.selection !== before.selection) presence()
  })
  connect()
  return {
    reserve,
    close: () => {
      stopped = true
      analysisEvent(projectId, 'connection.close')
      clearInterval(timer)
      clearTimeout(retry)
      unsubscribe()
      socket?.close()
    },
  }
}
