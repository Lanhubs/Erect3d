import type { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import type { ApiEnv } from '../middleware/types'
import type { Services } from '../config/services'
import { PrivateFilesystem } from './filesystem'
import { ApiError } from '../security/errors'
import { PrivateR2 } from './objects'
export function mountPrivateObjects(app: Hono<ApiEnv>, services: Services) {
  const store = services.store
  if(store instanceof PrivateR2) app.get('/private-assets/archive/:token',async context=>{
    const key=store.archives.verify(context.req.param('token'))
    context.header('Cache-Control','private, no-store');context.header('X-Content-Type-Options','nosniff')
    context.header('Content-Type','application/octet-stream')
    return context.body(await store.read(key,services.config.MAX_UPLOAD_BYTES))
  })
  if (!(store instanceof PrivateFilesystem)) return
  app.use('/private-assets/*', bodyLimit({ maxSize: services.config.MAX_UPLOAD_BYTES,
    onError: context => context.json({ error: { code: 'ASSET_TOO_LARGE', message: 'Upload exceeds its permitted size' } }, 413) }))
  app.put('/private-assets/:token', async context => {
    if (!services.config.ALLOWED_ORIGINS.split(',').map(value => value.trim()).includes(context.req.header('Origin') || '')) throw new ApiError(403,'ORIGIN_DENIED','Upload origin is not allowed')
    const ticket = store.verify(context.req.param('token'), 'PUT')
    if (context.req.header('Content-Type') !== ticket.mime) throw new ApiError(422,'ASSET_TYPE_MISMATCH','Upload type does not match its ticket')
    await store.write(ticket.key, new Uint8Array(await context.req.arrayBuffer()), ticket.mime!)
    return context.body(null, 204)
  })
  app.get('/private-assets/:token', async context => {
    const ticket = store.verify(context.req.param('token'), 'GET')
    context.header('Cache-Control','private, no-store'); context.header('X-Content-Type-Options','nosniff')
    context.header('Content-Type','application/octet-stream')
    try { return context.body(await store.read(ticket.key, services.config.MAX_UPLOAD_BYTES)) }
    catch (error) { if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') throw new ApiError(404,'ASSET_NOT_FOUND','Private asset is unavailable'); throw error }
  })
}
