import { S3Client } from 'bun'
import type { Config } from '../config/env'
import { ApiError } from '../security/errors'
import { unpackSource } from './archive'
import { ArchiveTickets } from './archive-ticket'
import {readPrivateObject} from './read-object'
export interface ObjectStore {
  uploadUrl(key: string, mime: string): string
  downloadUrl(key: string): string
  read(key: string, maximum: number): Promise<Uint8Array>
  stat(key: string): Promise<{ size: number }>
  write(key: string, bytes: Uint8Array, mime: string): Promise<void>
  delete(key: string): Promise<void>
  probe(): Promise<void>
}
export class PrivateR2 implements ObjectStore {
  private client: S3Client
  readonly archives:ArchiveTickets
  constructor(config: Config) {
    this.archives=new ArchiveTickets(config.R2_SECRET_ACCESS_KEY!)
    this.client = new S3Client({
      endpoint: config.R2_ENDPOINT, bucket: config.R2_BUCKET,
      region: config.R2_REGION, accessKeyId: config.R2_ACCESS_KEY_ID, secretAccessKey: config.R2_SECRET_ACCESS_KEY
    })
  }
  uploadUrl(key: string, mime: string) { return this.client.presign(key, { method: 'PUT', expiresIn: 300, type: mime }) }
  storedDownloadUrl(key:string) {return this.client.presign(key,{method:'GET',expiresIn:120})}
  downloadUrl(key: string) { return key.endsWith('.zip')?this.archives.download(key):this.storedDownloadUrl(key) }
  async stat(key: string) { const result = await this.client.stat(key); return { size: result.size } }
  async read(key: string, maximum: number) {
    const bytes = await readPrivateObject(this.storedDownloadUrl(key),maximum)
    return unpackSource(key,bytes,maximum)
  }
  async write(key: string, bytes: Uint8Array, mime: string) { await this.client.write(key, bytes, { type: mime }) }
  async delete(key: string) { await this.client.delete(key) }
  async probe() {
    // A known private sentinel distinguishes a configured bucket from a reachable endpoint.
    const key = '_erect3d/health'
    await this.client.write(key, 'ready', { type: 'text/plain' })
    await this.client.stat(key)
  }
}
export function requireStore(store?: ObjectStore): ObjectStore {
  if (!store) throw new ApiError(503, 'STORAGE_UNAVAILABLE', 'Private object storage has not been configured')
  return store
}
