import { createHmac, timingSafeEqual } from 'node:crypto'
import { mkdir, readFile, stat, unlink, writeFile } from 'node:fs/promises'
import { isAbsolute, join, relative, resolve } from 'node:path'
import type { ObjectStore } from './objects'
import { ApiError } from '../security/errors'
import { unpackSource } from './archive'
type Ticket = { key: string; method: 'GET' | 'PUT'; expires: number; mime?: string }
export class PrivateFilesystem implements ObjectStore {
  readonly root: string
  constructor(
    root: string,
    private secret: string,
  ) {
    if (!isAbsolute(root)) throw new Error('Private storage root must be absolute')
    this.root = resolve(root)
  }
  private path(key: string) {
    if (
      !/^[a-zA-Z0-9_./-]+$/.test(key) ||
      key.split('/').some((part) => !part || part === '.' || part === '..')
    )
      throw new ApiError(422, 'INVALID_OBJECT_KEY', 'Invalid object key')
    const path = resolve(this.root, key),
      inside = relative(this.root, path)
    if (!inside || inside.startsWith('..') || isAbsolute(inside))
      throw new ApiError(422, 'INVALID_OBJECT_KEY', 'Invalid object key')
    return path
  }
  private signature(payload: string) {
    return createHmac('sha256', this.secret).update(payload).digest('base64url')
  }
  private url(ticket: Ticket) {
    this.path(ticket.key)
    const payload = Buffer.from(JSON.stringify(ticket)).toString('base64url')
    return `/private-assets/${payload}.${this.signature(payload)}`
  }
  verify(token: string, method: 'GET' | 'PUT'): Ticket {
    const [payload, signature, extra] = token.split('.')
    const expected = Buffer.from(this.signature(payload || '')),
      actual = Buffer.from(signature || '')
    if (
      token.length > 2048 ||
      extra ||
      expected.length !== actual.length ||
      !timingSafeEqual(expected, actual)
    )
      throw new ApiError(403, 'ASSET_TICKET_INVALID', 'Private asset ticket is invalid')
    let ticket: Ticket
    try {
      ticket = JSON.parse(Buffer.from(payload, 'base64url').toString())
    } catch {
      throw new ApiError(403, 'ASSET_TICKET_INVALID', 'Private asset ticket is invalid')
    }
    if (ticket.method !== method || !Number.isFinite(ticket.expires) || ticket.expires < Date.now())
      throw new ApiError(403, 'ASSET_TICKET_EXPIRED', 'Private asset ticket expired or has the wrong method')
    this.path(ticket.key)
    return ticket
  }
  uploadUrl(key: string, mime: string) {
    return this.url({ key, mime, method: 'PUT', expires: Date.now() + 300000 })
  }
  downloadUrl(key: string) {
    return this.url({ key, method: 'GET', expires: Date.now() + 120000 })
  }
  async stat(key: string) {
    return { size: (await stat(this.path(key))).size }
  }
  async read(key: string, maximum: number) {
    const path = this.path(key),
      info = await stat(path)
    if (info.size > maximum) throw new ApiError(413, 'ASSET_TOO_LARGE', 'Object exceeded its permitted size')
    const bytes = await readFile(path)
    if (bytes.length > maximum)
      throw new ApiError(413, 'ASSET_TOO_LARGE', 'Object exceeded its permitted size')
    return unpackSource(key, new Uint8Array(bytes), maximum)
  }
  async write(key: string, bytes: Uint8Array, _mime: string) {
    const path = this.path(key)
    await mkdir(join(path, '..'), { recursive: true, mode: 0o700 })
    await writeFile(path, bytes, { mode: 0o600 })
  }
  async delete(key: string) {
    await unlink(this.path(key)).catch((error) => {
      if (error.code !== 'ENOENT') throw error
    })
  }
  async probe() {
    await this.write('_erect3d/health', new TextEncoder().encode('ready'), 'text/plain')
  }
}
