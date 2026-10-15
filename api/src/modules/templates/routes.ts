import { Hono } from 'hono'
import { z } from 'zod'
import type { ApiEnv } from '../../middleware/types'
import type { Database } from '../../db/connection'
import type { Config } from '../../config/env'
import { body,param,parse } from '../../contracts/http'
import { projectSchema } from '../../contracts/project'
import { newId } from '../../security/tokens'
import { ApiError } from '../../security/errors'
import { idempotent } from '../../security/idempotency'
import { audit } from '../audit/service'
import { saveSnapshot } from '../projects/documents'
import { validateGeometry } from '../projects/geometry-validation'
import { validateDocumentSize } from '../projects/size'
import { createSampleLibrary } from '../../../../client/src/domain/sampleLibrary'
const catalogue=createSampleLibrary()
const instantiate=z.object({duplicate:z.boolean().default(false)}).strict()
export function templateRoutes(db:Database,config:Config) {
  const routes=new Hono<ApiEnv>()
  routes.get('/',context=>{
    context.header('Cache-Control','private, no-cache')
    return context.json({version:1,items:catalogue})
  })
  routes.post('/:templateId/projects',async context=>{
    const templateId=param(context,'templateId'),input=await body(context,instantiate)
    const template=catalogue.find(item=>item.id===templateId)
    if (!template) throw new ApiError(404,'NOT_FOUND','Template not found')
    const actor=context.get('actor')
    const result=await idempotent(db,actor.id,'template.create',context.req.header('Idempotency-Key'),{templateId,...input},async tx=>{
      const document=parse(projectSchema,{...structuredClone(template.project),id:newId('project'),
        name:input.duplicate?`${template.title} copy`:template.title,modified:Date.now()})
      validateDocumentSize(document,config.MAX_PROJECT_BYTES);validateGeometry(document)
      await tx`INSERT INTO projects(id,owner_id,name) VALUES (${document.id},${actor.id},${document.name})`
      await saveSnapshot(tx,document.id,0,document)
      await audit(tx,actor,document.id,'project.created.from-template',context.get('requestId'),{templateId})
      return {projectId:document.id,revision:0}
    })
    return context.json(result,201)
  })
  return routes
}
