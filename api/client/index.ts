import type { Project } from '../../client/src/domain/types'
import type { Operation, AcceptedOperation } from '../src/contracts/operations'
export type { Project, Operation, AcceptedOperation }
export { documentChanges } from './diff'
export type Role = 'OWNER' | 'EDITOR' | 'REVIEWER' | 'CLIENT' | 'VIEWER'
export type Snapshot = { schemaVersion: number; projectId: string; revision: number; document: Project; checksum: string;
  role?: Role; allowClientApproval?: boolean }
export class RemoteError extends Error {
  status: number; code: string; requestId?: string; details?: unknown
  constructor(status: number, code: string, message: string, requestId?: string, details?: unknown) {
    super(message); this.status = status; this.code = code; this.requestId = requestId; this.details = details
  }
}
export class ErectApi {
  protected csrf?: string
  protected origin: string
  private fetcher: typeof fetch
  constructor(origin: string, fetcher: typeof fetch = fetch) { this.origin = origin; this.fetcher = fetcher }
  async request<T>(path: string, method = 'GET', input?: unknown, idempotencyKey?: string): Promise<T> {
    const headers = new Headers()
    if (input !== undefined) headers.set('Content-Type', 'application/json')
    if (this.csrf) headers.set('X-CSRF-Token', this.csrf)
    if (idempotencyKey) headers.set('Idempotency-Key', idempotencyKey)
    const fetcher = this.fetcher
    const response = await fetcher(`${this.origin}/api/v1${path}`, {
      method, headers, credentials: 'include',
      ...(input === undefined ? {} : { body: JSON.stringify(input) })
    })
    if (response.status === 204) return undefined as T
    const data = await response.json()
    if (!response.ok) throw new RemoteError(response.status, data.error?.code || 'REQUEST_FAILED',
      data.error?.message || 'Request failed', data.error?.requestId, data.error?.details)
    return data as T
  }
  async session() {
    const result = await this.request<{ user: { id: string; email: string; name: string }; csrfToken: string }>('/auth/session')
    this.csrf = result.csrfToken
    return result.user
  }
  async login(email: string, password: string) {
    const result = await this.request<{ user: { id: string; email: string; name: string }; csrfToken: string }>('/auth/login', 'POST', { email, password })
    this.csrf = result.csrfToken
    return result.user
  }
  async register(name: string, email: string, password: string) {
    const result = await this.request<{ user: { id: string; email: string; name: string }; csrfToken: string }>('/auth/register', 'POST', { name, email, password })
    this.csrf = result.csrfToken
    return result.user
  }
  async logout() { await this.request('/auth/logout', 'POST'); this.csrf = undefined }
  load(projectId: string) { return this.request<Snapshot>(`/projects/${encodeURIComponent(projectId)}`) }
  create(document: Project, teamId?: string, key: string = crypto.randomUUID()) {
    return this.request<{ projectId: string; revision: number }>('/projects', 'POST', { document, teamId }, key)
  }
  apply(projectId: string, operation: Operation) {
    return this.request<AcceptedOperation>(`/projects/${encodeURIComponent(projectId)}/operations`, 'POST', operation)
  }
  collaborationUrl(projectId: string, afterRevision: number) {
    const url = new URL(`${this.origin}/api/v1/realtime/projects/${encodeURIComponent(projectId)}`)
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
    url.searchParams.set('afterRevision', String(afterRevision))
    return url.toString()
  }
}
