import {z} from 'zod'
import {id,name,point,positive,scalar,color} from './primitives'
import type {ArchitecturalModel} from '../../../client/src/domain/buildingSystems'
export const typology=z.enum(['house','duplex','villa','apartment','office','office-tower','hotel','mixed-use','mall','school','hospital','public','industrial','stadium','arena','unknown'])
const polygon=z.array(point).min(3).max(1024),height=positive.max(2000)
const base={id,name,levelId:id,origin:z.enum(['detected','inferred','user-selected']),evidence:z.string().min(1).max(2000),
  visible:z.boolean().optional(),color,elevation:scalar}
export const systemSchema=z.discriminatedUnion('kind',[
  z.object({...base,kind:z.literal('core'),polygon,height,thickness:positive.max(5)}).strict(),
  z.object({...base,kind:z.literal('shaft'),polygon,height,thickness:positive.max(5)}).strict(),
  z.object({...base,kind:z.literal('void'),polygon,height,role:z.enum(['atrium','courtyard','shaft'])}).strict(),
  z.object({...base,kind:z.literal('beam'),start:point,end:point,width:positive.max(20),height}).strict(),
  z.object({...base,kind:z.literal('curtain-wall'),path:z.array(point).min(2).max(1024),height,bayWidth:positive.max(20),
    transomHeight:positive.max(20),depth:positive.max(2),curve:z.object({center:point,radius:positive,startAngle:scalar,endAngle:scalar}).strict().optional()}).strict(),
  z.object({...base,kind:z.literal('massing'),polygon,holes:z.array(polygon).max(100),height,
    role:z.enum(['podium','tower','wing','crown','mechanical'])}).strict(),
  z.object({...base,kind:z.literal('typical-floors'),templateLevelId:id,count:z.number().int().min(1).max(200),
    floorHeight:positive.max(20),detached:z.record(z.string().regex(/^\d+$/),id)}).strict(),
])
export const architecturalModelSchema:z.ZodType<ArchitecturalModel>=z.object({version:z.literal(1),typology,systems:z.array(systemSchema).max(2000)}).strict()
