import { RemoteError } from '../../../api/client'
export const connectionUnavailable = (error: unknown) =>
  error instanceof TypeError ||
  (error instanceof RemoteError &&
    (error.code === 'SERVICE_UNAVAILABLE' || [502, 503, 504].includes(error.status)))
export type OfflineIdentity = { id: string; name: string; email: string }
const key = 'erect-last-account'
// Identity only. Authentication cookies and CSRF tokens are never stored here.
export function rememberAccount(
  user: OfflineIdentity | null,
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> = localStorage,
) {
  try {
    if (user) storage.setItem(key, JSON.stringify(user))
    else storage.removeItem(key)
  } catch {
    /* Restricted storage must not break sign-in. */
  }
}
export function rememberedAccount(storage: Pick<Storage, 'getItem'> = localStorage): OfflineIdentity | null {
  try {
    const value = JSON.parse(storage.getItem(key) || 'null')
    return value &&
      typeof value.id === 'string' &&
      typeof value.name === 'string' &&
      typeof value.email === 'string'
      ? { id: value.id, name: value.name, email: value.email }
      : null
  } catch {
    return null
  }
}
