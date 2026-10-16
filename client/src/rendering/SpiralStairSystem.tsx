import {memo,useEffect,useMemo} from 'react'
import type {SpiralStairSystem as Stair} from '../domain/buildingSystems'
import type {Selection} from '../domain/types'
import {spiralTreadGeometry} from '../geometry/spiralStair'
import type {SystemPackage} from '../geometry/systemCompiler'
import {EntityInstances,spatialBatches} from './EntityInstances'
export const SpiralStairSystem=memo(function SpiralStairSystem({system,plan,select}:{system:Stair;plan:NonNullable<SystemPackage['spiral']>;select:(s:Selection)=>void}){
 const geometry=useMemo(()=>spiralTreadGeometry(system,plan.angle,plan.thickness),[system.radius,system.width,plan.angle,plan.thickness])
 useEffect(()=>()=>geometry.dispose(),[geometry])
 const steps=useMemo(()=>[...spatialBatches(plan.steps)],[plan.steps])
 return <group name={`spiral-stair:${system.id}`}>
  {steps.map(([key,parts])=><EntityInstances key={key} geometry={geometry} parts={parts} color={system.color} material={system.material} select={select}/>)}
  <EntityInstances parts={[plan.pole]} shape="column" color={system.color} material={system.material} select={select}/>
  <EntityInstances parts={plan.platforms} color={system.color} material={system.material} select={select}/>
  {[...spatialBatches([...plan.posts,...plan.rails])].map(([key,parts])=><EntityInstances key={key} parts={parts} color="#657175" material="metal" select={select}/>)}
 </group>
})
