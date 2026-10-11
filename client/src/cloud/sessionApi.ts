import { ErectApi, RemoteError } from '../../../api/client'
type Options = {
  lock: <T>(name: string, action: () => Promise<T>) => Promise<T>
  actor: () => string | null; expired: () => void; fetcher?: typeof fetch
}
export class SessionApi extends ErectApi {
  private options: Options
  constructor(origin: string, options: Options) { super(origin, options.fetcher); this.options = options }
  override async request<T>(path: string, method = 'GET', input?: unknown, key?: string): Promise<T> {
    const run = async () => {
      try {
        if (method !== 'GET' && !['/auth/login', '/auth/register'].includes(path)) {
          const expected = this.options.actor()
          const session = await super.request<{ csrfToken: string; user: { id: string } }>('/auth/session')
          if (!expected || session.user.id !== expected || this.options.actor() !== expected) throw new RemoteError(401, 'ACCOUNT_CHANGED', 'The account changed in another tab. Sign in again to continue.')
          this.csrf = session.csrfToken
        }
        return await super.request<T>(path, method, input, key)
      } catch (error) {
        if (error instanceof RemoteError && error.status === 401 && error.code !== 'LOGIN_FAILED') this.options.expired()
        throw error
      }
    }
    return method !== 'GET' || path === '/auth/session' ? this.options.lock('erect-cloud-auth', run) : run()
  }
}
