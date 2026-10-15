import { api, privateAssetUrl,browserLock } from './api'
import { getBlob, putBlob, getTask, putTask } from './cache'
import type { SourceDocument } from '../domain/types'
export type SourceLink = { source_id: string; original_asset_id: string; raster_asset_id: string }
export type StorageSavings = { inputBytes: number; storedBytes: number; savedBytes: number; method: string }
type Uploaded = { assetId: string; metadata: { width?: number; height?: number; orientation?: number }; optimization: StorageSavings }
type UploadTask = { originalAssetId?: string; rasterAssetId?: string; originalUploadKey?: string; rasterUploadKey?: string;
  originalMetadata?: Uploaded['metadata']; savings?: StorageSavings[] }
export const sourceLinks = (projectId: string) => api.request<SourceLink[]>(`/projects/${projectId}/sources`)
export async function loadPrivateSource(key: string, projectId: string, id: string) {
  const cached = await getBlob(key, id)
  if (cached) return cached
  const sourceId = id.replace(/:original$/, '')
  const link = (await sourceLinks(projectId)).find(link => link.source_id === sourceId)
  if (!link) return undefined
  const assetId = id.endsWith(':original') ? link.original_asset_id : link.raster_asset_id
  const ticket = await api.request<{ downloadUrl: string }>(`/projects/${projectId}/assets/${assetId}/download`)
  const response = await fetch(privateAssetUrl(ticket.downloadUrl), { credentials: 'omit', cache: 'no-store' })
  if (!response.ok) throw new Error('The private plan download failed. Retry to get a new signed link.')
  const blob = await response.blob(); await putBlob(key, id, blob); return blob
}
async function upload(projectId: string, blob: Blob, name: string, kind: 'source' | 'raster', mime: string, key: string) {
  const query = new URLSearchParams({ name, kind, mime })
  return api.request<Uploaded>(`/projects/${projectId}/assets/optimized-upload?${query}`, 'POST', new Blob([blob], { type: mime }), key)
}
async function uprightPng(blob: Blob) {
  const bitmap = await createImageBitmap(blob), canvas = document.createElement('canvas')
  canvas.width = bitmap.width; canvas.height = bitmap.height; canvas.getContext('2d')!.drawImage(bitmap, 0, 0); bitmap.close()
  try { return await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not prepare the upright plan')), 'image/png')) }
  finally { canvas.width = 0; canvas.height = 0 }
}
export async function uploadPrivateSource(key: string, projectId: string, source: SourceDocument, report?: (savings: StorageSavings[]) => void) {
  return browserLock(`erect-upload:${key}:${source.id}`,()=>uploadSource(key,projectId,source,report))
}
async function uploadSource(key: string, projectId: string, source: SourceDocument, report?: (savings: StorageSavings[]) => void) {
  const taskKey = `${key}/upload/${source.id}`
  const task = await getTask<UploadTask>(taskKey) || {}
  const image = await getBlob(key, source.id)
  if (!image) throw new Error('Import this plan again to upload its original file.')
  const original = source.mime === 'application/pdf' ? await getBlob(key, `${source.id}:original`) : image
  if (!original) throw new Error('The original PDF is missing. Import it again.')
  if (!task.originalAssetId) {
    task.originalUploadKey ||= crypto.randomUUID(); await putTask(taskKey, task)
    const uploaded = await upload(projectId, original, source.name, 'source', source.mime, task.originalUploadKey)
    task.originalAssetId = uploaded.assetId; task.originalMetadata = uploaded.metadata; task.savings = [uploaded.optimization]
    await putTask(taskKey, task)
  }
  if (!task.rasterAssetId) {
    const originalIsUpright = source.mime !== 'application/pdf' && task.originalMetadata?.orientation === 1 && task.originalMetadata.width === source.width && task.originalMetadata.height === source.height
    if (originalIsUpright) task.rasterAssetId = task.originalAssetId
    else {
      const png = source.mime === 'application/pdf' ? image : await uprightPng(image)
      task.rasterUploadKey ||= crypto.randomUUID(); await putTask(taskKey, task)
      const uploaded = await upload(projectId, png, `${source.name} (upright page)`, 'raster', 'image/png', task.rasterUploadKey)
      task.rasterAssetId = uploaded.assetId; task.savings = [...(task.savings || []), uploaded.optimization]
    }
    await putTask(taskKey, task)
  }
  await api.request(`/projects/${projectId}/sources/${source.id}`, 'PUT', { originalAssetId: task.originalAssetId, rasterAssetId: task.rasterAssetId, ...(source.page ? { page: source.page } : {}) })
  report?.(task.savings || [])
  return task.rasterAssetId
}
export async function syncPrivateSources(key:string,projectId:string,sources:SourceDocument[]) {
  if (!sources.length) return
  const links=await sourceLinks(projectId)
  for (const source of sources) if (!links.some(link=>link.source_id===source.id) && await getBlob(key,source.id)) {
    await uploadPrivateSource(key,projectId,source)
  }
}
