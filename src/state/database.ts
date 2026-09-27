import type { Project, SourceDocument } from '../domain/types'
import { initialAutoScale } from '../geometry/autoScale'

const DB = 'erect3d-v1'
const open = () => new Promise<IDBDatabase>((resolve, reject) => {
  const request = indexedDB.open(DB, 1)
  request.onupgradeneeded = () => {
    request.result.createObjectStore('projects', { keyPath: 'id' })
    request.result.createObjectStore('sources')
  }
  request.onsuccess = () => resolve(request.result)
  request.onerror = () => reject(request.error)
})
async function store<T>(name: string, mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(name, mode)
    const request = action(tx.objectStore(name))
    let result: T
    request.onsuccess = () => { result = request.result }
    request.onerror = () => reject(request.error)
    tx.oncomplete = () => { db.close(); resolve(result) }
    tx.onerror = () => { db.close(); reject(tx.error) }
  })
}
export const listProjects = () => store<Project[]>('projects', 'readonly', target => target.getAll())
export const loadProject = (id: string) => store<Project | undefined>('projects', 'readonly', target => target.get(id))
export const saveProject = (project: Project) => store<IDBValidKey>('projects', 'readwrite', target => target.put(project))
export async function deleteProject(project: Project): Promise<void> {
  const db = await open()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(['projects', 'sources'], 'readwrite')
    tx.objectStore('projects').delete(project.id)
    for (const source of project.sources) {
      tx.objectStore('sources').delete(source.id)
      tx.objectStore('sources').delete(`${source.id}:original`)
    }
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}
export const saveSource = (id: string, blob: Blob) => store<IDBValidKey>('sources', 'readwrite', target => target.put(blob, id))
export const loadSource = (id: string) => store<Blob | undefined>('sources', 'readonly', target => target.get(id))
export async function replaceProjectSource(project: Project, document: SourceDocument, blob: Blob, original?: Blob): Promise<Project> {
  const copy = structuredClone(project)
  const previous = copy.sources[0]?.id
  copy.sources = [document]
  copy.calibration = initialAutoScale(document.width, document.height)
  copy.modified = Date.now()
  if (previous) for (const level of copy.buildings.flatMap(building => building.levels)) {
    level.walls = []; level.doors = []; level.windows = []; level.passages = []; level.rooms = []
  }
  const db = await open()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(['projects', 'sources'], 'readwrite')
      const sources = tx.objectStore('sources')
      sources.put(blob, document.id)
      if (original) sources.put(original, `${document.id}:original`)
      tx.objectStore('projects').put(copy)
      if (previous) { sources.delete(previous); sources.delete(`${previous}:original`) }
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
    })
    return copy
  } finally { db.close() }
}
export async function deleteSource(id: string): Promise<void> {
  const db = await open()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('sources', 'readwrite')
    tx.objectStore('sources').delete(id)
    tx.objectStore('sources').delete(`${id}:original`)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}
