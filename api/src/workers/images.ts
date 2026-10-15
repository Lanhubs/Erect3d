import sharp from 'sharp'
import { z } from 'zod'
import type { Database } from '../db/connection'
import type { Job } from '../jobs/queue'
import type { ObjectStore } from '../storage/objects'
import { requireStore } from '../storage/objects'
import { id } from '../contracts/primitives'
import { parse } from '../contracts/http'
import { digest } from '../security/tokens'
import { requireValue } from '../security/errors'
import { writeDerivedAsset } from './output'
export async function normalizeImage(db: Database, store: ObjectStore | undefined, job: Job) {
  const { assetId } = parse(z.object({ assetId:id }).strict(),job.payload), storage = requireStore(store)
  const [asset] = await db`SELECT * FROM assets WHERE id=${assetId} AND project_id=${job.project_id} AND state='ready'`
  requireValue(asset)
  const bytes = await storage.read(asset.object_key,209715200)
  const image = sharp(bytes,{ limitInputPixels:100_000_000 }).rotate()
  const metadata = await image.metadata()
  const reuse = (metadata.orientation || 1) === 1
  const raster = reuse ? undefined : await image.clone()
    .png({ compressionLevel:9,adaptiveFiltering:true,palette:false }).toBuffer()
  const thumbnail = await image.clone().resize({ width:640,height:640,fit:'inside',withoutEnlargement:true }).webp().toBuffer()
  const result: Record<string,string> = reuse ? { raster:asset.id } : {}
  for (const [kind,content,mime] of [['raster',raster,'image/png'],['thumbnail',thumbnail,'image/webp']] as const) {
    if (!content) continue
    const id = `asset_${digest(`${job.id}:${kind}`).slice(0,32)}`
    const metadata = await sharp(content).metadata()
    await writeDerivedAsset(db,storage,job,id,{
      bytes:content,mime,kind,name:`${kind}-${asset.name}`,parentId:asset.id,
      metadata:{ width:metadata.width,height:metadata.height,orientation:1,originalWidth:asset.metadata.width,originalHeight:asset.metadata.height },
    })
    result[kind] = id
  }
  return result
}
export async function purgeAsset(db:Database,store: ObjectStore | undefined, job: Job) {
  const input = parse(z.object({ key:z.string().min(1).max(1024).regex(/^(private|staging)\//),pendingAssetId:id.optional() }).strict(),job.payload)
  if (!input.key.startsWith(`private/${job.project_id}/`) && !input.key.startsWith(`staging/${job.project_id}/`)) throw new Error('Invalid object ownership')
  await requireStore(store).delete(input.key)
  if (input.pendingAssetId) await db`UPDATE assets SET state='rejected' WHERE id=${input.pendingAssetId} AND state='pending'`
  return { deleted:true }
}
