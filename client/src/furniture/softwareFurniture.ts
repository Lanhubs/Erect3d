import {Vector3,type BufferGeometry} from 'three'
import type {Level} from '../domain/types'
import {furnitureParts} from './assets'
import {furnitureGeometry,geometryKey} from './geometry'
import {partTransform} from './partTransform'
import type {SoftwareFace} from '../rendering/softwareDetails'
import type {Vertex} from '../geometry/roof'
export function softwareFurniture(level:Level):SoftwareFace[]{
 const cache=new Map<string,BufferGeometry>(),faces:SoftwareFace[]=[]
 for(const object of level.furniture||[])for(const [partIndex,part] of furnitureParts(object).entries()){
  const key=geometryKey(part)
  if(!cache.has(key))cache.set(key,furnitureGeometry(part.shape,part.size,part.finish==='fabric',true))
  const geometry=cache.get(key)!,positions=geometry.getAttribute('position'),indices=geometry.index,matrix=partTransform(object,part)
  const vertex=(i:number):Vertex=>new Vector3().fromBufferAttribute(positions,indices?indices.getX(i):i).applyMatrix4(matrix).toArray() as Vertex
  for(let i=0;i<(indices?.count||positions.count);i+=3){
   const vertices=[vertex(i),vertex(i+1),vertex(i+2)]
   faces.push({key:`${object.id}:${partIndex}:${i}`,vertices,fill:part.color,depth:vertices.reduce((sum,p)=>sum+p[0]+p[2],0)/3,select:{kind:'furniture',id:object.id}})
  }
 }
 cache.forEach(g=>g.dispose())
 return faces
}
