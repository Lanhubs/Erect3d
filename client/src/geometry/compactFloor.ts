import {Matrix4,Texture,type BufferGeometry,type Material,type JSONMeta,type TextureJSON} from 'three'
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js'
import {disposeCapturedFloor,type CapturedFloorPackage} from './captureFloor'

// A linked floor is picked as a floor, so compatible source meshes can share
// one baked geometry. Each resulting package is still instanced by storey.
// Materials and textures remain borrowed from the hidden editable template.
export function compactFloor(source:CapturedFloorPackage[]):CapturedFloorPackage[]{
  const signatures=new Map<Material,string>(),buckets=new Map<string,CapturedFloorPackage[]>()
  for(const item of source){
    const custom=item.material.type.includes('Shader')||Object.hasOwn(item.material,'onBeforeCompile')||Object.hasOwn(item.material,'customProgramCacheKey')
    if(!signatures.has(item.material)){
      if(custom)signatures.set(item.material,item.material.uuid)
      else{
        const meta:JSONMeta={textures:{},images:{},geometries:{},materials:{},shapes:{},skeletons:{},animations:{},nodes:{}}
        // Compare texture identities, without PNG-encoding every canvas image.
        for(const value of Object.values(item.material))if(value instanceof Texture)meta.textures[value.uuid]={uuid:value.uuid} as TextureJSON
        const data=item.material.toJSON(meta)
        const json=Object.fromEntries(Object.entries(data).filter(([key])=>!['uuid','name','metadata'].includes(key)))
        signatures.set(item.material,JSON.stringify(json))
      }
    }
    const attributes=Object.entries(item.geometry.attributes).map(([name,a])=>`${name}:${a.itemSize}:${a.normalized}`).sort().join('|')
    const safe=!custom&&!item.geometry.getAttribute('skinIndex')&&!Object.keys(item.geometry.morphAttributes).length&&item.geometry.drawRange.start===0&&item.geometry.drawRange.count===Infinity&&item.matrices.every(matrix=>matrix.determinant()>0)
    const key=safe?`${signatures.get(item.material)}:${attributes}:${item.castShadow}:${item.receiveShadow}`:`unmerged:${buckets.size}`
    const bucket=buckets.get(key)||[];bucket.push(item);buckets.set(key,bucket)
  }
  const output:CapturedFloorPackage[]=[],replaced:CapturedFloorPackage[]=[]
  try{
    for(const items of buckets.values()){
      if(items.length<2){output.push(...items);continue}
      const pieces:BufferGeometry[]=[]
      try{
        for(const item of items)for(const matrix of item.matrices){
          const geometry=item.geometry.index?item.geometry.toNonIndexed():item.geometry.clone()
          geometry.applyMatrix4(matrix);pieces.push(geometry)
        }
        const geometry=mergeGeometries(pieces,false)
        if(!geometry){output.push(...items);continue}
        geometry.computeBoundingBox();geometry.computeBoundingSphere()
        output.push({...items[0],geometry,matrices:[new Matrix4()],ownedGeometry:true});replaced.push(...items)
      }finally{pieces.forEach(geometry=>geometry.dispose())}
    }
    disposeCapturedFloor(replaced)
    return output
  }catch(error){
    // Only merged geometries belong to this operation on failure.
    output.filter(item=>!source.includes(item)).forEach(item=>item.geometry.dispose())
    throw error
  }
}
