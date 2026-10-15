import {useMemo} from 'react'
import {EntityInstances,spatialBatches,type InstancePart} from './EntityInstances'
export function SitePropInstances({cars,trees,y}:{cars:{x:number;z:number;color:string}[];trees:[number,number][];y:number}){
  const batches=useMemo(()=>{
    const carBodies=new Map<string,InstancePart[]>(),carWindows:InstancePart[]=[],wheels:InstancePart[]=[],trunks:InstancePart[]=[],crowns=new Map<string,InstancePart[]>()
    cars.forEach(car=>{
      const parts=carBodies.get(car.color)||[];parts.push({center:[car.x,y+.65,car.z],size:[3.8,.65,1.9],rotation:0});carBodies.set(car.color,parts)
      carWindows.push({center:[car.x-.2,y+1.15,car.z],size:[2,.55,1.65],rotation:0})
      for(const x of [-1.2,1.2])for(const z of [-.96,.96])wheels.push({center:[car.x+x,y+.35,car.z+z],size:[1,1,1],rotation:0})
    })
    trees.forEach(([x,z],index)=>{
      trunks.push({center:[x,y+1.63,z],size:[1,3.2,1],rotation:0})
      for(let cluster=0;cluster<5;cluster++){
        const angle=cluster*2.4+index*.7,color=['#3e6638','#4b7840','#355b31'][cluster%3],radius=cluster===0?2.1:1.65
        const parts=crowns.get(color)||[];parts.push({center:[x+(cluster?Math.cos(angle)*1.1:0),y+4.2+(cluster?Math.sin(angle)*.6:.8),z+(cluster?Math.sin(angle)*1.1:0)],size:[radius,radius*.85,radius],rotation:angle});crowns.set(color,parts)
      }
    })
    return {carBodies,carWindows,wheels,trunks,crowns}
  },[cars,trees,y])
  return <group name="spatially-instanced-site-props">
    {[...batches.carBodies].flatMap(([color,parts])=>[...spatialBatches(parts,48)].map(([zone,rows])=><EntityInstances key={`car:${color}:${zone}`} parts={rows} color={color} material="metal"/>))}
    {[...spatialBatches(batches.carWindows,48)].map(([zone,rows])=><EntityInstances key={`glass:${zone}`} parts={rows} color="#0f172a" material="metal"/>)}
    {[...spatialBatches(batches.wheels,48)].map(([zone,rows])=><EntityInstances key={`wheels:${zone}`} parts={rows} shape="wheel" color="#23272a"/>)}
    {[...spatialBatches(batches.trunks,48)].map(([zone,rows])=><EntityInstances key={`trunk:${zone}`} parts={rows} shape="tree-trunk" color="#4a3728"/>)}
    {[...batches.crowns].flatMap(([color,parts])=>[...spatialBatches(parts,48)].map(([zone,rows])=><EntityInstances key={`crown:${color}:${zone}`} parts={rows} shape="leaf-crown" color={color}/>))}
  </group>
}
