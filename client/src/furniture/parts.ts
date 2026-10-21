import type {FurnitureObject} from './types'
export type FurnitureShape='box'|'soft-box'|'cylinder'|'sphere'|'taper'|'bowl'|'ring'|'chair-back'
export type FurnitureFinish='fabric'|'timber'|'metal'|'ceramic'|'glass'|'stone'|'plastic'
export type FurniturePart={shape:FurnitureShape;at:[number,number,number];size:[number,number,number];color:string;finish:FurnitureFinish;roughness:number;metalness:number;opacity?:number;rotation?:[number,number,number]}
export function partBuilder(object:FurnitureObject){
 const parts:FurniturePart[]=[],w=object.width,d=object.depth,h=object.height
 const paint=object.materialOverrides?.color||'#c4b9a6'
 const add=(x:number,y:number,z:number,a:number,b:number,c:number,color=paint,shape:FurnitureShape='soft-box',finish:FurnitureFinish='timber',rotation?:[number,number,number])=>{
  if(color===paint&&object.materialOverrides?.finish)finish=object.materialOverrides.finish
  parts.push({shape,at:[x*w,y*h,z*d],size:[a*w,b*h,c*d],color,finish,rotation,
   roughness:finish==='fabric'?.9:finish==='ceramic'?.18:finish==='metal'?.27:finish==='glass'?.09:finish==='stone'?.34:.52,metalness:finish==='metal'?.85:0})
  return parts[parts.length-1]
 }
 const legs=(top=.8,color='#65503d',finish:FurnitureFinish='timber',spread=0)=>{
  for(const x of [-.38,.38])for(const z of [-.35,.35])add(x,top/2,z,.045,top,.045,color,'taper',finish,[z*spread,0,-x*spread])
 }
 return {object,parts,paint,add,legs}
}
export type PartBuilder=ReturnType<typeof partBuilder>
