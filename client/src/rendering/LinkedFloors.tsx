import {memo,useEffect,useLayoutEffect,useMemo,useRef} from 'react'
import {InstancedMesh,Matrix4} from 'three'
import type {Building,Level,Selection} from '../domain/types'
import type {TypicalFloorGroup} from '../domain/buildingSystems'
import {linkedFloorIndices,typicalFloorElevation} from '../domain/typicalFloors'
import {floorPackages,type FloorPackage} from '../geometry/floorPackages'
import {useRenderResources} from './RenderResources'
function Package({item,elevations,indices,group,select}:{item:FloorPackage;elevations:number[];indices:number[];group:TypicalFloorGroup;select:(s:Selection)=>void}){
  const ref=useRef<InstancedMesh>(null),resources=useRenderResources(),surface=resources.material(item.slot,item.color)
  useEffect(()=>{resources.retain(surface);return()=>resources.release(surface)},[resources,surface])
  useEffect(()=>{const mesh=ref.current;return()=>mesh?.dispose()},[item.geometry,elevations.length])
  useLayoutEffect(()=>{
    const mesh=ref.current;if(!mesh)return
    const matrix=new Matrix4();elevations.forEach((y,i)=>mesh.setMatrixAt(i,matrix.makeTranslation(0,y,0)))
    mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingBox();mesh.computeBoundingSphere()
  },[item.geometry,elevations])
  return <instancedMesh ref={ref} args={[item.geometry,undefined,elevations.length]} material={surface} dispose={null} castShadow={item.slot!=='glass'} receiveShadow
    onClick={e=>{e.stopPropagation();select({kind:'architecture',id:group.id,floorIndex:indices[e.instanceId||0]})}}/>
}
export const LinkedFloors=memo(function LinkedFloors({building,group,template,select}:{building:Building;group:TypicalFloorGroup;template:Level;select:(s:Selection)=>void}){
  const packages=useMemo(()=>floorPackages(template),[template])
  useEffect(()=>()=>packages.forEach(p=>p.geometry.dispose()),[packages])
  const indices=useMemo(()=>linkedFloorIndices(building,group),[building.levels,group])
  const elevations=useMemo(()=>indices.map(i=>typicalFloorElevation(building,group,i)),[building.levels,group,indices])
  return <group name={`linked-floors:${group.id}`}>{!!indices.length&&packages.map((item,i)=><Package key={i} item={item} group={group} indices={indices} elevations={elevations} select={select}/>)}</group>
})
