import {createContext,useContext,useEffect,useMemo,type ReactNode} from 'react'
import {BoxGeometry,CylinderGeometry,ConeGeometry,SphereGeometry,MeshStandardMaterial,MeshPhysicalMaterial,type BufferGeometry,type Material} from 'three'
export type InstanceShape='box'|'column'|'tree-trunk'|'tree-crown'|'leaf-crown'|'wheel'
export class RenderResources {
  geometries=new Map<InstanceShape,BufferGeometry>()
  materials=new Map<string,Material>()
  references=new Map<Material,number>()
  geometry(shape:InstanceShape){
    if(!this.geometries.has(shape)){
      const geometry=shape==='box'?new BoxGeometry(1,1,1):shape==='tree-crown'?new ConeGeometry(1,1,8):shape==='leaf-crown'?new SphereGeometry(1,16,10):shape==='tree-trunk'?new CylinderGeometry(.22,.32,1,8):shape==='wheel'?new CylinderGeometry(.35,.35,.22,12).rotateX(Math.PI/2):new CylinderGeometry(.5,.5,1,24)
      this.geometries.set(shape,geometry)
    }
    return this.geometries.get(shape)!
  }
  material(key:string,color:string){
    const id=`${key}:${color}`
    if(!this.materials.has(id))this.materials.set(id,key==='glass'?new MeshPhysicalMaterial({color,metalness:.08,roughness:.12,transparent:true,opacity:.65,depthWrite:false}):new MeshStandardMaterial({color,roughness:key==='metal'?.35:key==='seat'?.52:.8,metalness:key==='metal'?.6:.02}))
    return this.materials.get(id)!
  }
  retain(material:Material){this.references.set(material,(this.references.get(material)||0)+1)}
  release(material:Material){
    this.references.set(material,Math.max(0,(this.references.get(material)||0)-1))
    queueMicrotask(()=>{
      if(this.references.get(material)!==0)return
      this.references.delete(material)
      for(const [key,value] of this.materials)if(value===material){this.materials.delete(key);material.dispose();break}
    })
  }
  dispose(){this.geometries.forEach(value=>value.dispose());this.materials.forEach(value=>value.dispose());this.geometries.clear();this.materials.clear()}
}
const Resources=createContext<RenderResources|null>(null)
export function RenderResourceScope({children}:{children:ReactNode}){
  const library=useMemo(()=>new RenderResources(),[])
  useEffect(()=>()=>library.dispose(),[library])
  return <Resources.Provider value={library}>{children}</Resources.Provider>
}
export function useRenderResources(){const value=useContext(Resources);if(!value)throw new Error('Render resource scope is missing');return value}
