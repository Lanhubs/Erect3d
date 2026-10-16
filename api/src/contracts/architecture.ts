import {z} from 'zod'
import {id,name,point,positive,scalar,color} from './primitives'
import type {ArchitecturalModel} from '../../../client/src/domain/buildingSystems'
import {maxFloorInstances} from '../../../client/src/domain/floorRepetition'
import {articulationProfiles,architecturalSurfaces} from '../../../client/src/domain/articulation'
export const typology=z.enum(['house','duplex','villa','apartment','office','office-tower','hotel','mixed-use','mall','school','hospital','public','industrial','stadium','arena','unknown'])
const polygon=z.array(point).min(3).max(1024),height=positive.max(2000)
export const floorLayoutEvidence=z.object({matchesTemplate:z.literal(true),sourcePages:z.array(z.number().int().min(1).max(1000)).min(1).max(1000),levelNames:z.array(z.string().min(1).max(200)).min(1).max(1000),reason:z.string().min(1).max(2000)}).strict()
const base={id,name,levelId:id,origin:z.enum(['detected','inferred','design-proposal','user-selected']),evidence:z.string().min(1).max(2000),assumptions:z.array(z.string().min(1).max(500)).max(20).optional(),
  visible:z.boolean().optional(),color,elevation:scalar}
export const systemSchema=z.discriminatedUnion('kind',[
  z.object({...base,kind:z.literal('spiral-stair'),center:point,radius:positive.max(2000),width:positive.max(2000),height,riserHeight:positive.max(1),turnHeight:positive.max(2000),rotation:scalar,clockwise:z.boolean(),material:z.enum(['metal','concrete']),landings:z.array(z.object({levelId:id,angle:scalar}).strict()).max(1000).optional()}).strict(),
  z.object({...base,kind:z.literal('articulation'),repeatWithFloor:z.boolean().optional(),profile:z.enum(articulationProfiles),material:z.enum(architecturalSurfaces),path:z.array(point).length(2),footprint:polygon.optional(),curve:z.object({center:point,radius:positive,startAngle:scalar,endAngle:scalar}).strict().optional(),height,depth:positive.max(2000),thickness:positive.max(20),spacing:positive.max(2000),side:z.enum(['left','right'])}).strict(),
  z.object({...base,kind:z.literal('core'),wallIds:z.array(id).max(20000).optional(),polygon,height,thickness:positive.max(5)}).strict(),
  z.object({...base,kind:z.literal('shaft'),wallIds:z.array(id).max(20000).optional(),polygon,height,thickness:positive.max(5)}).strict(),
  z.object({...base,kind:z.literal('void'),polygon,height,role:z.enum(['atrium','courtyard','shaft'])}).strict(),
  z.object({...base,kind:z.literal('beam'),start:point,end:point,width:positive.max(20),height}).strict(),
  z.object({...base,kind:z.literal('curtain-wall'),wallIds:z.array(id).max(20000).optional(),path:z.array(point).min(2).max(1024),height,bayWidth:positive.max(20),
    transomHeight:positive.max(20),depth:positive.max(2),curve:z.object({center:point,radius:positive,startAngle:scalar,endAngle:scalar}).strict().optional()}).strict(),
  z.object({...base,kind:z.literal('massing'),polygon,holes:z.array(polygon).max(100),height,
    role:z.enum(['podium','tower','wing','crown','mechanical'])}).strict(),
  z.object({...base,kind:z.literal('typical-floors'),layoutEvidence:floorLayoutEvidence.optional(),templateLevelId:id,count:z.number().int().min(1).max(maxFloorInstances),
    floorHeight:positive.max(20),detached:z.record(z.string().regex(/^\d+$/),id)}).strict(),
])
export const architecturalModelSchema:z.ZodType<ArchitecturalModel>=z.object({version:z.literal(1),typology,systems:z.array(systemSchema).max(2000)}).strict()
