import {memo,useEffect,useMemo} from 'react'
import type {Building,Selection} from '../domain/types'
import type {BuildingSystem} from '../domain/buildingSystems'
import {validateSystems} from '../domain/systemValidation'
import {compileSystem} from '../geometry/systemCompiler'
import {systemMassGeometry} from '../geometry/systemMass'
import {EntityInstances,spatialBatches} from './EntityInstances'
import {LinkedFloors} from './LinkedFloors'
function Mass({system,select}:{system:Extract<BuildingSystem,{kind:'massing'}>;select:(s:Selection)=>void}){
  const geometry=useMemo(()=>systemMassGeometry(system),[system])
  useEffect(()=>()=>geometry.dispose(),[geometry])
  return <mesh geometry={geometry} castShadow receiveShadow onClick={e=>{e.stopPropagation();select({kind:'architecture',id:system.id})}}>
    <meshStandardMaterial color={system.color} roughness={.8}/>
  </mesh>
}
const System=memo(function System({system,select}:{system:BuildingSystem;select:(s:Selection)=>void}){
  const data=useMemo(()=>compileSystem(system),[system])
  return <group name={`architectural-system:${system.id}`}>
    {system.kind==='massing'&&<Mass system={system} select={select}/>}
    {[...spatialBatches(data.parts)].map(([zone,parts])=><EntityInstances key={`solid:${zone}`} parts={parts} color={system.color} select={select}/>)}
    {[...spatialBatches(data.glass)].map(([zone,parts])=><EntityInstances key={`glass:${zone}`} parts={parts} color="#a4c7d2" material="glass" shadow={false} select={select}/>)}
    {[...spatialBatches(data.frame)].map(([zone,parts])=><EntityInstances key={`frame:${zone}`} parts={parts} color={system.color} material="metal" select={select}/>)}
  </group>
})
export function BuildingSystems({building,shownIds,select}:{building:Building;shownIds:ReadonlySet<string>;select:(s:Selection)=>void}){
  const errors=useMemo(()=>validateSystems(building),[building.systems,building.levels])
  if(errors.length)return null
  return <group name="semantic-building-systems">{building.systems?.systems.filter(s=>s.visible!==false&&shownIds.has(s.levelId)).map(system=>{
    if(system.kind==='typical-floors'){
      const template=building.levels.find(l=>l.id===system.templateLevelId)
      return template?<LinkedFloors key={system.id} group={system} template={template} building={building} select={select}/>:null
    }
    const elevation=building.levels.find(l=>l.id===system.levelId)?.elevation||0
    return <group key={system.id} position={[0,elevation,0]}><System system={system} select={select}/></group>
  })}</group>
}
