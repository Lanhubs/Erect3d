import {articulationProfiles} from '../../../../client/src/domain/articulation'

// Keep the provider grammar shallow. The full discriminated canonical contract
// still validates dimensions for each kind after generation.
const groups={cores:'core',shafts:'shaft',voids:'void',beams:'beam',facades:'curtain-wall',masses:'massing',repeatedFloors:'typical-floors',details:'articulation',spiralStairs:'spiral-stair'} as const

function normalizeSystem(system:any){
 if(!system||typeof system!=='object')return system
 const {depth:topDepth,thickness:topThickness,spacing:topSpacing,...item}=system
 const p=item.parameters?{...item.parameters}:{height:2.8}
 if(item.kind==='articulation'){
  let profile=item.profile||p.profile
  delete p.profile
  if(!articulationProfiles.includes(profile)){
   const text=`${item.name||''} ${item.evidence||''} ${item.id||''} ${profile||''}`.toLowerCase()
   if(/balcon/i.test(text))profile='balcony'
   else if(/veranda|patio|terrace|deck/i.test(text))profile='veranda'
   else if(/pergola|trellis/i.test(text))profile='pergola'
   else if(/fin|shading|louver|louvre/i.test(text))profile='fins'
   else if(/colonnade|column|pillar/i.test(text))profile='colonnade'
   else if(/cornice/i.test(text))profile='cornice'
   else if(/plinth/i.test(text))profile='plinth'
   else if(/parapet/i.test(text))profile='parapet'
   else if(/railing|balustrade|guard/i.test(text))profile='railing'
   else if(/portal/i.test(text))profile='portal'
   else if(/arch/i.test(text))profile='arch'
   else if(/cladding|facade|skin/i.test(text))profile='cladding'
   else profile='canopy'
  }
  const defaultDepth=profile==='fins'?.3:(profile==='balcony'||profile==='veranda'?1.5:1.0)
  const defaultThickness=profile==='fins'?.08:.18
  const defaultSpacing=profile==='fins'?.6:1.0
  p.height=typeof p.height==='number'&&p.height>0?p.height:2.8
  p.depth=typeof p.depth==='number'&&p.depth>0?p.depth:(typeof topDepth==='number'&&topDepth>0?topDepth:defaultDepth)
  p.thickness=typeof p.thickness==='number'&&p.thickness>0?p.thickness:(typeof topThickness==='number'&&topThickness>0?topThickness:defaultThickness)
  p.spacing=typeof p.spacing==='number'&&p.spacing>0?p.spacing:(typeof topSpacing==='number'&&topSpacing>0?topSpacing:defaultSpacing)
  return {...item,profile,parameters:p}
 }
 if(item.kind==='typical-floors'){
  const floorHeight=typeof p.floorHeight==='number'&&p.floorHeight>0?p.floorHeight:3.2
  const count=typeof p.count==='number'&&p.count>=1?Math.round(p.count):Math.max(2,Math.round((typeof p.height==='number'&&p.height>0?p.height:6.4)/floorHeight))
  p.floorHeight=floorHeight;p.count=count
  p.height=typeof p.height==='number'&&p.height>0?p.height:count*floorHeight
  return {...item,parameters:p}
 }
 return {...item,parameters:p}
}

export function architecturalWireSchema(schema:any){
 const branches=schema.properties.systems.items.anyOf||schema.properties.systems.items.oneOf
 const properties:any={},parameters:any={}
 for(const branch of branches){Object.assign(properties,structuredClone(branch.properties));Object.assign(parameters,structuredClone(branch.properties.parameters.properties))}
 properties.kind={type:'string',enum:Object.values(groups).filter(kind=>kind!=='spiral-stair')}
 properties.material=structuredClone(branches.find((b:any)=>(b.properties.kind.enum?.[0]||b.properties.kind.const)==='articulation').properties.material)
 properties.parameters={type:'object',properties:parameters,required:['height'],additionalProperties:false,
  description:'Metres. All systems require height. Articulation requires profile at system root, and depth, thickness and spacing in parameters. Typical floors require count and floorHeight; height is their total extent.'}
 if(properties.layoutEvidence?.properties.matchesTemplate)properties.layoutEvidence.properties.matchesTemplate={type:'boolean',description:'True only after verifying identical layouts on the named source pages.'}
 const spiral=structuredClone(properties);delete spiral.kind
 spiral.parameters={...spiral.parameters,required:['height','radius','width','riserHeight','turnHeight']}
 return {type:'object',properties:{typology:schema.properties.typology,systems:{type:'array',items:{type:'object',properties,required:['id','name','kind','origin','evidence','parameters'],additionalProperties:false}},
  spiralStairs:{type:'array',items:{type:'object',properties:spiral,required:['id','name','boundaryId','origin','evidence','parameters'],additionalProperties:false}}},required:['typology','systems','spiralStairs'],additionalProperties:false}
}

export function normalizeArchitecturalWire(value:any){
 const architecture=value?.architecturalRequirements
 if(!architecture)return value
 if(Array.isArray(architecture.systems)){
  if(!Array.isArray(architecture.spiralStairs)&&!architecture.systems.some((s:any)=>s?.kind==='articulation'||s?.kind==='typical-floors'))return value
  const spiralStairs=Array.isArray(architecture.spiralStairs)?architecture.spiralStairs:[]
  const {spiralStairs:_,...rest}=architecture
  return {...value,architecturalRequirements:{...rest,systems:[...architecture.systems.map(normalizeSystem),...spiralStairs.map((item:any)=>({...item,kind:'spiral-stair'}))]}}
 }
 if(!Object.keys(groups).some(key=>Array.isArray(architecture[key])))return value
 return {...value,architecturalRequirements:{typology:architecture.typology,systems:Object.entries(groups).flatMap(([group,kind])=>(architecture[group]||[]).map((item:any)=>normalizeSystem({...item,kind})))} }
}

export const architecturalWireInstructions='Wire format: architecturalRequirements contains typology, systems:[] and spiralStairs:[]. Put spiral stairs ONLY in spiralStairs, without kind; that dedicated array requires height, radius, clear radial width, riserHeight and turnHeight in parameters. Other systems go in systems with kind. Each entry requires id, name, origin, evidence and parameters.height in metres. Source-bound systems also require their exact boundaryId. Articulation requires profile at root, and depth, thickness and spacing in parameters. Typical floors require count and floorHeight; height is their total extent. Omit inapplicable optional fields. The server normalizes spiralStairs to canonical kind=spiral-stair entities and ensures valid dimensions, preserving all geometry and strict per-kind validation.'
