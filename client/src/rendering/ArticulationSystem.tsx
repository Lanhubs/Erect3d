import {memo,useEffect,useMemo} from 'react'
import type {ArticulationSystem as Detail} from '../domain/buildingSystems'
import type {Selection} from '../domain/types'
import type {SystemPackage} from '../geometry/systemCompiler'
import {articulationSurface} from '../geometry/articulationSurface'
import {EntityInstances,spatialBatches} from './EntityInstances'
import {useRenderResources} from './RenderResources'
function Surface({system,top,select}:{system:Detail;top:boolean;select:(s:Selection)=>void}){
  const geometry=useMemo(()=>articulationSurface(system,top),[system,top]),resources=useRenderResources()
  const material=resources.material(system.material,system.color)
  useEffect(()=>{resources.retain(material);return()=>resources.release(material)},[resources,material])
  useEffect(()=>()=>geometry?.dispose(),[geometry])
  return geometry?<mesh geometry={geometry} material={material} dispose={null} castShadow receiveShadow onClick={e=>{e.stopPropagation();select({kind:'architecture',id:system.id})}}/>:null
}
export const ArticulationSystem=memo(function ArticulationSystem({system,parts,select}:{system:Detail;parts:NonNullable<SystemPackage['articulation']>;select:(s:Selection)=>void}){
  const batches=useMemo(()=>(['body','edge','glass','columns'] as const).flatMap(slot=>[...spatialBatches(parts[slot])].map(([zone,batch])=>({slot,zone,batch}))),[parts])
  return <group name={`articulation:${system.id}`}>
    {system.profile==='arch'&&<Surface system={system} top={false} select={select}/>}
    {(system.footprint||system.curve)&&['canopy','balcony','veranda'].includes(system.profile)&&<>
      {system.profile!=='canopy'&&<Surface system={system} top={false} select={select}/>}
      {system.profile!=='balcony'&&<Surface system={system} top select={select}/>}
    </>}
    {batches.map(({slot,zone,batch})=><EntityInstances key={`${slot}:${zone}`} parts={batch}
      color={slot==='edge'?'#5e6669':slot==='glass'?'#b1cad0':system.color} material={slot==='edge'?'metal':slot==='glass'?'glass':system.material}
      shape={slot==='columns'&&system.profile==='colonnade'?'column':'box'} select={select}/>)}
  </group>
})
