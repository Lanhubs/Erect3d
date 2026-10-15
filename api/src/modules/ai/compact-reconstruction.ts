import {architecturalRequirements} from '../../contracts/architectural-requirements'
import {z} from 'zod'
import {intelligenceSchema,type Candidate} from '../../contracts/analysis'
import {furnitureTypes} from '../../../../client/src/furniture/types'
import {visionSchema} from '../../contracts/vision'
const coord=z.number().min(0).max(1),point=z.tuple([coord,coord]),points=z.array(point).min(1).max(1024)
const entity={id:z.string().min(1).max(160),points}
const curve=z.object({center:point,radius:z.number().positive().max(2),startAngle:z.number(),endAngle:z.number()}).strict()
export const compactReconstruction=z.object({
  architecturalRequirements:architecturalRequirements.optional(),
  buildingType:z.enum(['house','apartment','office','public','mall','stadium','arena','unknown']),footprint:points,
  vision:visionSchema.optional(),
  scale:z.object({a:point,b:point,knownMetres:z.number().positive().max(10000),origin:z.enum(['annotated','inferred']),evidence:z.string().min(1).max(1000)}).strict().optional(),
  walls:z.array(z.object({...entity,thickness:z.number().positive().max(.1).optional(),wallKind:z.enum(['exterior','interior','partition']).optional(),curve:curve.optional()}).strict()).max(1000),
  wallRefs:z.array(z.number().int().nonnegative().max(1999)).max(1000).optional(),
  strokeLabels:z.record(z.string(),z.string().regex(/^[012]*$/)),
  openings:z.array(z.object({...entity,kind:z.enum(['door','window','passage']),wallId:z.string().min(1).optional(),wallRef:z.number().int().nonnegative().max(1999).optional(),doorStyle:z.enum(['flush','panel','glazed','double']).optional(),hinge:z.enum(['left','right']).optional(),swing:z.enum(['in','out']).optional(),windowType:z.enum(['fixed','casement','sliding']).optional()}).strict()).max(500),
  rooms:z.array(z.object({...entity,name:z.string().max(200),roomCategory:z.enum(['basketball-court','football-pitch','table-tennis-hall']).optional()}).strict()).max(200),
  columns:z.array(z.object({...entity,columnShape:z.enum(['rectangular','circular']).optional()}).strict()).max(200),
  stairs:z.array(z.object({...entity,stairForm:z.enum(['straight','L','U']).optional(),reverse:z.boolean().optional()}).strict()).max(100),
  fixtures:z.array(z.object({...entity,type:z.enum(furnitureTypes)}).strict()).max(200),warnings:z.array(z.string().max(1000)).max(40),
}).strict()
const imagePoint=([x,y]:[number,number])=>({x,y})
export function expandReconstruction(value:unknown,measurements:Candidate[]=[]) {
  const parsed=compactReconstruction.parse(value)
  const candidate=(item:z.infer<typeof compactReconstruction>['walls'][number],kind:Candidate['kind']):Candidate=>({
    ...item,kind,points:item.points.map(imagePoint),curve:item.curve?{...item.curve,center:imagePoint(item.curve.center)}:undefined,
    confidence:.8,evidence:'Source geometry traced in a coordinated full-plan interpretation.',uncertainties:['Vertical dimensions are defaults unless independently established.'],needsReview:true})
  const measured=measurements.filter(item=>item.kind==='wall')
  const groups=Array.from({length:Math.ceil(measured.length/25)},(_,index)=>index*25)
  if(Object.keys(parsed.strokeLabels).length!==groups.length || groups.some(start=>parsed.strokeLabels[String(start)]?.length!==Math.min(25,measured.length-start)))throw new Error('Every source measurement requires classification')
  const labels=measured.map((_,ref)=>parsed.strokeLabels[String(Math.floor(ref/25)*25)][ref%25])
  const selected=labels.flatMap((label,ref)=>label==='1'?[ref]:[])
  const references=[...new Set([...selected,...parsed.wallRefs || []])].map(ref=>{
    const wall=measured[ref];if(!wall)throw new Error('Unknown measured wall reference')
    return {...wall,confidence:.8,needsReview:true as const,evidence:'Native source stroke classified as a building wall in the complete-plan interpretation.'}
  })
  const candidates=[...references,...parsed.walls.map(item=>candidate(item,'wall')),
    ...parsed.openings.map(({wallRef,...item})=>{
      const wallId=wallRef===undefined?item.wallId:measured[wallRef]?.id
      if(wallRef!==undefined && !wallId)throw new Error('Unknown opening host reference')
      return candidate({...item,wallId} as typeof parsed.walls[number],item.kind)
    }),...parsed.columns.map(item=>candidate(item,'column')),
    ...parsed.stairs.map(item=>candidate(item,'stair')),
    ...parsed.rooms.map(({name,...item})=>({...candidate(item,'room'),label:name})),
    ...parsed.fixtures.map(({type,...item})=>({...candidate(item,'furniture'),furnitureType:type}))]
  return intelligenceSchema.parse({coordinatesVersion:1,coordinateSystem:'normalized-image-top-left',candidates,warnings:parsed.warnings,vision:parsed.vision,architecturalRequirements:parsed.architecturalRequirements,
    dispositions:labels.map((label,ref)=>({candidateId:measured[ref].id,decision:label==='1'?'confirm':label==='0'?'reject':'defer',reason:label==='1'?'Source stroke represents an architectural wall':label==='0'?'Source stroke is non-wall detail or a duplicate edge':'Source stroke is ambiguous'})),
    understanding:{buildingType:parsed.buildingType,footprint:parsed.footprint.map(imagePoint),conventions:[],circulation:[],uncertainties:parsed.warnings.slice(0,20),
      scale:parsed.scale?{...parsed.scale,origin:/standard|regulation|typical|fiba/i.test(parsed.scale.evidence)?'inferred':parsed.scale.origin,a:imagePoint(parsed.scale.a),b:imagePoint(parsed.scale.b)}:undefined}})
}
export function compactMeasurements(items:Candidate[]) {
  // The response references the untouched measurements. Rounding only the numeric
  // prompt removes floating-point noise; erected geometry retains original precision.
  const short=(number:number)=>Number(number.toFixed(6))
  return items.filter(item=>item.kind==='wall').map((item,ref)=>[ref,
    ...item.points.flatMap(({x,y})=>[short(x),short(y)]),short(item.thickness || 0)])
}
// Gemini accepts homogeneous numeric arrays; full tuple lengths are checked locally.
export function compactReconstructionSchema(measurementCount?:number):Record<string,unknown> {
  const schema=z.toJSONSchema(compactReconstruction) as any
  const simplify=(value:any):any=>{
    if(Array.isArray(value))return value.map(simplify)
    if(!value || typeof value!=='object')return value
    if(value.prefixItems)return {type:'array',items:{type:'number',minimum:0,maximum:1}}
    return Object.fromEntries(Object.entries(value).filter(([key])=>!['$schema','minLength','maxLength','minItems','maxItems'].includes(key)).map(([key,item])=>[key,simplify(item)]))
  }
  const result=simplify(schema)
  if(measurementCount!==undefined){
    const groups=Array.from({length:Math.ceil(measurementCount/25)},(_,index)=>index*25)
    result.properties.strokeLabels={type:'object',properties:Object.fromEntries(groups.map(start=>[String(start),{type:'string',description:`Exactly ${Math.min(25,measurementCount-start)} characters for refs ${start} through ${Math.min(start+24,measurementCount-1)}. 0=other, 1=wall, 2=uncertain.`}])),required:groups.map(String),additionalProperties:false}
  }
  return result
}
