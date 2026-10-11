import type { WSContext } from 'hono/ws'

export function sendFrame(ws: WSContext, value: unknown) {
  const raw = ws.raw as { getBufferedAmount?: () => number } | undefined
  if ((raw?.getBufferedAmount?.() || 0) > 4 * 1024 * 1024) {
    ws.close(1013, 'Reconnect and reload the latest snapshot')
    return false
  }
  const frame = JSON.stringify(value)
  if (new TextEncoder().encode(frame).byteLength > 4 * 1024 * 1024) {
    ws.close(1009, 'Load this state through the snapshot endpoint')
    return false
  }
  ws.send(frame)
  return true
}
