import { create } from 'zustand'
import { api, setExpectedUser } from './api'
import { RemoteError } from '../../../api/client'
export type User = { id: string; name: string; email: string }
type Account = { user: User | null; checking: boolean; error: string; generation: number }
export const useAccount = create<Account>(() => ({ user: null, checking: false, error: '', generation: 0 }))
useAccount.subscribe(state => setExpectedUser(state.user?.id || null))
const channel = typeof BroadcastChannel === 'undefined' ? undefined : new BroadcastChannel('erect-cloud-account')
let refresh: Promise<void> | undefined
export function refreshAccount() {
  if (refresh) return refresh
  useAccount.setState({ checking: true, error: '' })
  refresh = api.session().then(user => { useAccount.setState({ user }) }).catch(error => {
    if (error instanceof RemoteError && error.status === 401) useAccount.setState({ user: null })
    else useAccount.setState({ error: (error as Error).message })
  }).finally(() => { refresh = undefined; useAccount.setState({ checking: false }) })
  return refresh
}
export async function signIn(email: string, password: string, name?: string) {
  const user = name ? await api.register(name, email, password) : await api.login(email, password)
  useAccount.setState(state => ({ user, error: '', generation: state.generation + 1 }))
  channel?.postMessage('changed')
}
export async function signOut() {
  await api.logout()
  useAccount.setState(state => ({ user: null, generation: state.generation + 1 }))
  channel?.postMessage('changed')
}
channel?.addEventListener('message', () => {
  // Hide the previous account's project immediately; recheck the shared HttpOnly cookie.
  useAccount.setState(state => ({ user: null, generation: state.generation + 1 }))
  void refreshAccount()
})
window.addEventListener('erect-session-expired', () => {
  useAccount.setState(state => ({ user: null, generation: state.generation + 1 }))
})
