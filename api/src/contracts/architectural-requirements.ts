import {z} from 'zod'
import {id} from './primitives'
import {typology} from './architecture'
const dimension=z.number().positive().max(2000)
export const architecturalRequirements=z.object({typology,systems:z.array(z.object({
  id,name:z.string().min(1).max(200),kind:z.enum(['core','shaft','void','beam','curtain-wall','massing','typical-floors']),
  boundaryId:id.optional(),origin:z.enum(['detected','inferred']),evidence:z.string().min(1).max(2000),
  role:z.enum(['atrium','courtyard','shaft','podium','tower','wing','crown','mechanical']).optional(),
  parameters:z.object({height:dimension.optional(),width:dimension.optional(),thickness:dimension.optional(),
    bayWidth:dimension.optional(),transomHeight:dimension.optional(),depth:dimension.optional(),
    count:z.number().int().min(1).max(200).optional(),floorHeight:dimension.optional(),elevation:z.number().finite().optional()}).strict(),
}).strict()).max(200)}).strict()
export type ArchitecturalRequirements=z.infer<typeof architecturalRequirements>
