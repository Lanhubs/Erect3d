import type { CloudRecord, CloudRepository } from './types'
const open = () => new Promise<IDBDatabase>((resolve, reject) => {
  const request = indexedDB.open('erect3d-cloud-v1', 1)
  request.onupgradeneeded = () => {
    request.result.createObjectStore('documents', { keyPath: 'key' })
    request.result.createObjectStore('blobs')
    request.result.createObjectStore('tasks')
  }
  request.onsuccess = () => resolve(request.result)
  request.onerror = () => reject(request.error)
})
export async function cache<T>(name: string, mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(name, mode), request = action(tx.objectStore(name))
    let result: T
    request.onsuccess = () => { result = request.result }
    tx.oncomplete = () => { db.close(); resolve(result) }
    tx.onabort = tx.onerror = () => { db.close(); reject(tx.error || request.error || new Error('Cloud cache write failed')) }
  })
}
export const repository: CloudRepository = {
  get: key => cache<CloudRecord | undefined>('documents', 'readonly', store => store.get(key)),
  put: async record => { await cache('documents', 'readwrite', store => store.put(record)) },
}
export const cachedRecords = (userId: string) => cache<CloudRecord[]>('documents', 'readonly', store => store.getAll())
  .then(records => records.filter(record => record.userId === userId))
export const blobKey = (key: string, sourceId: string) => `${key}/source/${sourceId}`
export const getBlob = (key: string, sourceId: string) => cache<Blob | undefined>('blobs', 'readonly', store => store.get(blobKey(key, sourceId)))
export const putBlob = async (key: string, sourceId: string, blob: Blob) => { await cache('blobs', 'readwrite', store => store.put(blob, blobKey(key, sourceId))) }
export const getTask = <T>(key: string) => cache<T | undefined>('tasks', 'readonly', store => store.get(key))
export const putTask = async (key: string, task: unknown) => { await cache('tasks', 'readwrite', store => store.put(task, key)) }
