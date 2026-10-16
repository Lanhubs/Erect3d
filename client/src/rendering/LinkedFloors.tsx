import {memo,useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react'
import {Group,InstancedMesh,Matrix4} from 'three'
import {useThree} from '@react-three/fiber'
import type {Building,Level,Selection} from '../domain/types'
import type {TypicalFloorGroup} from '../domain/buildingSystems'
import {linkedFloorIndices,typicalFloorElevation,repeatedDetails} from '../domain/typicalFloors'
import {floorPages} from '../domain/floorRepetition'
import {captureFloor,disposeCapturedFloor,type CapturedFloorPackage} from '../geometry/captureFloor'
import {levelWithSystemVoids} from '../geometry/systemCompiler'
import {GraphicsSettings} from './GraphicsRuntime'
import {LevelGeometry} from './LevelGeometry'
import {useFurnitureReview} from '../furniture/reviewState'
import {SceneIssue} from './SceneIssue'
import {ArticulationSystem} from './ArticulationSystem'
import {compileSystem} from '../geometry/systemCompiler'
function Package({item,elevations,indices,group,select}:{item:CapturedFloorPackage;elevations:number[];indices:number[];group:TypicalFloorGroup;select:(s:Selection)=>void}){
  const ref=useRef<InstancedMesh>(null),count=elevations.length*item.matrices.length
  useEffect(()=>{const mesh=ref.current;return()=>mesh?.dispose()},[item.geometry,count])
  useLayoutEffect(()=>{
    const mesh=ref.current;if(!mesh)return
    const offset=new Matrix4(),matrix=new Matrix4()
    elevations.forEach((y,floor)=>{offset.makeTranslation(0,y,0);item.matrices.forEach((source,i)=>mesh.setMatrixAt(floor*item.matrices.length+i,matrix.multiplyMatrices(offset,source)))})
    mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingBox();mesh.computeBoundingSphere()
  },[item,elevations])
  return <instancedMesh ref={ref} args={[item.geometry,undefined,count]} material={item.material} dispose={null} castShadow={item.castShadow} receiveShadow={item.receiveShadow}
    onClick={e=>{e.stopPropagation();select({kind:'architecture',id:group.id,floorIndex:indices[Math.floor((e.instanceId||0)/item.matrices.length)]})}}/>
}
const emptyIds=new Set<string>(),closedDoors=new Set<string>(),ignore=()=>{}
const captureSettings={optimized:false,tier:'high' as const}
export const LinkedFloors=memo(function LinkedFloors({building,group,template,select,roofShown}:{building:Building;group:TypicalFloorGroup;template:Level;select:(s:Selection)=>void;roofShown:boolean}){
  const source=useRef<Group>(null),[packages,setPackages]=useState<CapturedFloorPackage[]>([]),[error,setError]=useState('')
  const invalidate=useThree(s=>s.invalidate),furnitureShown=useFurnitureReview(s=>s.shown)
  const indices=useMemo(()=>linkedFloorIndices(building,group),[building.levels,group])
  const pages=useMemo(()=>floorPages(indices).map(indices=>({indices,elevations:indices.map(i=>typicalFloorElevation(building,group,i))})),[building.levels,group,indices])
  const curtainIds=useMemo(()=>new Set(building.systems?.systems.flatMap(s=>s.kind==='curtain-wall'&&s.visible!==false?s.wallIds||[]:[])||[]),[building.systems])
  const prepared=useMemo(()=>levelWithSystemVoids(template,building),[template,building.systems,building.levels])
  const details=useMemo(()=>repeatedDetails(building,template.id).map(system=>({system,parts:compileSystem(system,prepared).articulation!})),[building.systems,template.id,prepared])
  useLayoutEffect(()=>{
    if(!source.current)return
    try{setPackages(captureFloor(source.current,indices.length));setError('')}catch(e){setError(String(e));setPackages([])}
    invalidate()
  },[prepared,building.levels,curtainIds,roofShown,furnitureShown,indices.length,invalidate,details])
  useEffect(()=>()=>disposeCapturedFloor(packages),[packages])
  return <group name={`linked-floors:${group.id}`} userData={{compileError:error}}>
    <SceneIssue id={group.id} message={error}/>
    <group ref={source} visible={false}><GraphicsSettings.Provider value={captureSettings}>
      <LevelGeometry level={prepared} levels={building.levels} generatedIds={emptyIds} curtainIds={curtainIds} selection={null} select={ignore} ceiling={false} roofShown={roofShown} walk={false} openDoors={closedDoors}/>
      {details.map(({system,parts})=><ArticulationSystem key={system.id} system={system} parts={parts} select={ignore}/>)}
    </GraphicsSettings.Provider></group>
    {pages.map((page,pageIndex)=><group key={pageIndex} name={`floor-page:${page.indices[0]}`}>
      {packages.map((item,i)=><Package key={i} item={item} group={group} indices={page.indices} elevations={page.elevations} select={select}/>)}
    </group>)}
  </group>
})
