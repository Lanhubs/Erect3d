import { api } from './api'
import { getBlob, putBlob, getTask, putTask } from './cache'
import type { SourceDocument } from '../domain/types'
export type SourceLink = { source_id: string; original_asset_id: string; raster_asset_id: string }
export const sourceLinks = (projectId: string) => api.request<SourceLink[]>(`/projects/${projectId}/sources`)
export async function loadPrivateSource(key: string, projectId: string, id: string) {
  const cached = await getBlob(key, id)
  if (cached) return cached
  const sourceId = id.replace(/:original$/, '')
  const link = (await sourceLinks(projectId)).find(link => link.source_id === sourceId)
  if (!link) return undefined
  const assetId = id.endsWith(':original') ? link.original_asset_id : link.raster_asset_id
  const ticket = await api.request<{ downloadUrl: string }>(`/projects/${projectId}/assets/${assetId}/download`)
  const response = await fetch(ticket.downloadUrl, { credentials: 'omit', cache: 'no-store' })
  if (!response.ok) throw new Error('The private plan download failed. Retry to get a new signed link.')
  const blob = await response.blob(); await putBlob(key, id, blob); return blob
}
async function upload(projectId: string, blob: Blob, name: string, kind: 'source' | 'raster', mime: string) {
  const ticket = await api.request<{ assetId: string; uploadUrl: string; requiredHeaders: Record<string, string> }>(
    `/projects/${projectId}/assets/uploads`, 'POST', { name, mime, kind, size: blob.size })
  const response = await fetch(ticket.uploadUrl, { method: 'PUT', headers: ticket.requiredHeaders, body: blob, credentials: 'omit' })
  if (!response.ok) throw new Error('Private storage rejected the upload. Check storage CORS and retry.')
  await api.request(`/projects/${projectId}/assets/${ticket.assetId}/finalize`, 'POST')
  return ticket.assetId
}
async function uprightPng(blob: Blob) {
  const bitmap = await createImageBitmap(blob), canvas = document.createElement('canvas')
  canvas.width = bitmap.width; canvas.height = bitmap.height; canvas.getContext('2d')!.drawImage(bitmap, 0, 0); bitmap.close()
  try { return await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not prepare the upright plan')), 'image/png')) }
  finally { canvas.width = 0; canvas.height = 0 }
}
export async function uploadPrivateSource(key: string, projectId: string, source: SourceDocument) {
  const taskKey = `${key}/upload/${source.id}`
  const task = await getTask<{ originalAssetId?: string; rasterAssetId?: string }>(taskKey) || {}
  const image = await getBlob(key, source.id)
  if (!image) throw new Error('Import this plan again to upload its original file.')
  const original = source.mime === 'application/pdf' ? await getBlob(key, `${source.id}:original`) : image
  if (!original) throw new Error('The original PDF is missing. Import it again.')
  if (!task.originalAssetId) {
    task.originalAssetId = await upload(projectId, original, source.name, 'source', source.mime)
    await putTask(taskKey, task)
  }
  if (!task.rasterAssetId) {
    const png = source.mime === 'application/pdf' ? image : await uprightPng(image)
    task.rasterAssetId = await upload(projectId, png, `${source.name} (upright page)`, 'raster', 'image/png')
    await putTask(taskKey, task)
  }
  await api.request(`/projects/${projectId}/sources/${source.id}`, 'PUT', { ...task, ...(source.page ? { page: source.page } : {}) })
  return task.rasterAssetId
}
