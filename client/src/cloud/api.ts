import { SessionApi } from './sessionApi'
const origin = (
  import.meta.env.VITE_API_ORIGIN || (typeof window !== 'undefined' ? window.location.origin : '')
).replace(/\/$/, '')
export const privateAssetUrl = (url: string) => new URL(url, `${origin}/`).href
let expectedUser: string | null = null
export function setExpectedUser(id: string | null) {
  expectedUser = id
}
export async function browserLock<T>(name: string, action: () => Promise<T>): Promise<T> {
  if (!navigator.locks) throw new Error('Cloud mode requires a secure browser with Web Locks support.')
  return navigator.locks.request(name, action)
}
// Refresh and mutation share one origin-wide lock. Tokens never race other tabs.
export const api = new SessionApi(origin, {
  lock: browserLock,
  actor: () => expectedUser,
  expired: () => window.dispatchEvent(new Event('erect-session-expired')),
})
export async function capabilities() {
  const response = await fetch(`${origin}/ready`, { credentials: 'omit' })
  if (!response.ok) throw new Error('The cloud service is not ready.')
  return (await response.json()).capabilities as {
    privateAssets: boolean
    cloudAnalysis: boolean
    assistant?: boolean
    realtime: boolean
  }
}
export async function paginated<T>(path: string): Promise<T[]> {
  const items: T[] = []
  let cursor: string | null = null
  do {
    const page: { items: T[]; nextCursor: string | null } = await api.request(
      `${path}${path.includes('?') ? '&' : '?'}limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`,
    )
    items.push(...page.items)
    cursor = page.nextCursor
  } while (cursor)
  return items
}
