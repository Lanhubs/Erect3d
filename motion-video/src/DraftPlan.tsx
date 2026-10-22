import {useMemo} from 'react'
import {ground,building} from './model'
import {wallSolids,wallRects} from '../../client/src/geometry/walls'
import {atWall,wallTangentAngle} from '../../client/src/geometry/math'
import {roomShapes} from '../../client/src/rendering/roomShape'
import {stairSteps,localToWorld} from '../../client/src/geometry/stairs'
export function DraftPlan(){
 const paths=useMemo(()=>ground.doors.map(d=>{const w=ground.walls.find(w=>w.id===d.wallId)!,a=atWall(w,d.offset),angle=wallTangentAngle(w,d.offset);return new Float32Array(Array.from({length:25},(_,i)=>{const theta=i/24*Math.PI/2,u=Math.cos(theta)*d.width,v=Math.sin(theta)*d.width;return [a.x+Math.cos(angle)*u-Math.sin(angle)*v,.05,a.z+Math.sin(angle)*u+Math.cos(angle)*v]}).flat())}),[])
 const stairs=useMemo(()=>(ground.stairs||[]).flatMap(s=>stairSteps(s,building.levels).map(step=>{const a=localToWorld(s,step.u,step.v-step.width/2),b=localToWorld(s,step.u,step.v+step.width/2);return {x:(a.x+b.x)/2,z:(a.z+b.z)/2,length:Math.hypot(a.x-b.x,a.z-b.z),angle:-Math.atan2(b.z-a.z,b.x-a.x)}})),[])
 return <>
 {ground.rooms.map(room=><mesh key={room.id} rotation={[Math.PI/2,0,0]} position={[0,.01,0]}><shapeGeometry args={[roomShapes(room,[])]}/><meshBasicMaterial color="#eee8dd" side={2}/></mesh>)}
 {ground.walls.flatMap(w=>wallSolids(w,ground.doors,ground.windows,ground.passages).filter(s=>s.bottom===0).flatMap(s=>wallRects(w,s)).map((r,i)=><mesh key={`${w.id}:${i}`} position={[r.center[0],.035,r.center[2]]} rotation={[0,r.rotation,0]}><boxGeometry args={[r.size[0],.025,r.size[2]]}/><meshBasicMaterial color="#343a34"/></mesh>))}
 {ground.windows.map(w=>{const host=ground.walls.find(h=>h.id===w.wallId)!,p=atWall(host,w.offset+w.width/2);return <mesh key={w.id} position={[p.x,.05,p.z]} rotation={[0,-wallTangentAngle(host,w.offset),0]}><boxGeometry args={[w.width,.015,.055]}/><meshBasicMaterial color="#8a999b"/></mesh>})}
 {paths.map((array,i)=><line key={i}><bufferGeometry><bufferAttribute attach="attributes-position" args={[array,3]}/></bufferGeometry><lineBasicMaterial color="#92816a"/></line>)}
 {stairs.map((s,i)=><mesh key={i} position={[s.x,.05,s.z]} rotation={[0,s.angle,0]}><boxGeometry args={[s.length,.015,.018]}/><meshBasicMaterial color="#7f796e"/></mesh>)}
 </>
}

