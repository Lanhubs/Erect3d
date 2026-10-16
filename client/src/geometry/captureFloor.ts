import {BufferGeometry,InstancedMesh,Matrix4,Mesh,type Material,type Object3D} from 'three'
import {maxFloorInstances} from '../domain/floorRepetition'
export type CapturedFloorPackage={geometry:BufferGeometry;material:Material;matrices:Matrix4[];ownedGeometry:boolean;castShadow:boolean;receiveShadow:boolean}
// Capture the existing semantic emitters once, including furniture, stairs,
// curved walls, ramps and details. Linked floors reuse their actual geometry.
export function captureFloor(root:Object3D,repeats:number):CapturedFloorPackage[]{
  root.updateWorldMatrix(true,true)
  const inverse=new Matrix4().copy(root.matrixWorld).invert(),packages=new Map<string,CapturedFloorPackage>()
  const included=(object:Object3D)=>{let current:Object3D|null=object;while(current&&current!==root){if(!current.visible)return false;current=current.parent}return true}
  let count=0
  root.traverse(object=>{if(object instanceof Mesh&&included(object))count+=(object instanceof InstancedMesh?object.count:1)*(Array.isArray(object.material)?object.geometry.groups.length:1)})
  if(count*repeats>maxFloorInstances)throw new Error('Linked floors exceed the two-million-instance budget; split the group or simplify its template.')
  const owned:BufferGeometry[]=[]
  try{
    root.traverse(object=>{
      if(!(object instanceof Mesh)||!included(object)||!object.geometry.getAttribute('position'))return
      const mesh=object as Mesh,materials=Array.isArray(mesh.material)?mesh.material:[mesh.material]
      const ranges=Array.isArray(mesh.material)?mesh.geometry.groups:[{start:mesh.geometry.drawRange.start,count:mesh.geometry.drawRange.count,materialIndex:0}]
      for(const range of ranges){
        const material=materials[range.materialIndex||0];if(!material||material.visible===false)continue
        const key=`${mesh.geometry.uuid}:${material.uuid}:${range.start}:${range.count}:${mesh.castShadow}:${mesh.receiveShadow}`
        let item=packages.get(key)
        if(!item){
          let geometry=mesh.geometry,ownedGeometry=false
          if(Array.isArray(mesh.material)){
            geometry=geometry.clone();owned.push(geometry);ownedGeometry=true
            const index=geometry.getIndex(),end=Math.min(range.start+range.count,index?.count||geometry.getAttribute('position').count)
            geometry.setIndex(index?Array.from(index.array.slice(range.start,end)):Array.from({length:end-range.start},(_,i)=>i+range.start))
            geometry.clearGroups();geometry.setDrawRange(0,Infinity);geometry.computeBoundingBox();geometry.computeBoundingSphere()
          }
          item={geometry,material,matrices:[],ownedGeometry,castShadow:mesh.castShadow,receiveShadow:mesh.receiveShadow};packages.set(key,item)
        }
        const parent=new Matrix4().multiplyMatrices(inverse,mesh.matrixWorld)
        if(mesh instanceof InstancedMesh){const local=new Matrix4();for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,local);item.matrices.push(new Matrix4().multiplyMatrices(parent,local))}}
        else item.matrices.push(parent)
      }
    })
    return [...packages.values()]
  }catch(error){owned.forEach(g=>g.dispose());throw error}
}
export function disposeCapturedFloor(packages:CapturedFloorPackage[]){packages.forEach(item=>{if(item.ownedGeometry)item.geometry.dispose()})}
