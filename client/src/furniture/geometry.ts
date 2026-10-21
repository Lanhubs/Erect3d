import {BoxGeometry,CylinderGeometry,SphereGeometry,TorusGeometry,LatheGeometry,Vector2,Shape,ExtrudeGeometry,type BufferGeometry} from 'three'
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js'
import type {FurniturePart,FurnitureShape} from './parts'
export function geometryKey(part:FurniturePart){return part.shape==='soft-box'?`${part.shape}:${part.finish}:${part.size.join(',')}`:part.shape}
// Rounded parts are built in metres: stretching a unit bevel made thin doors,
// cushions and headboards acquire visibly different corner radii on each axis.
export function furnitureGeometry(shape:FurnitureShape,size:[number,number,number]=[1,1,1],fabric=false,preview=false):BufferGeometry{
 let geometry:BufferGeometry
 if(shape==='soft-box'){
  geometry=new RoundedBoxGeometry(...size,preview?1:3,Math.min(...size)*(fabric?.42:.16))
  geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry
 }
 if(shape==='box')geometry=new BoxGeometry(1,1,1)
 else if(shape==='cylinder')geometry=new CylinderGeometry(.5,.5,1,preview?12:32)
 else if(shape==='taper')geometry=new CylinderGeometry(.36,.5,1,preview?8:24)
 else if(shape==='sphere')geometry=new SphereGeometry(.5,preview?12:32,preview?8:20)
 else if(shape==='ring')geometry=new TorusGeometry(.44,.06,preview?6:10,preview?16:40).rotateX(Math.PI/2).scale(1,1/.12,1)
 else if(shape==='bowl'){
  // Closed ceramic shell: outer underside -> rolled lip -> sloping inner bowl.
  // The interior descends below the lip; there is no painted top or flat lid.
  const profile=[[0,-.5],[.22,-.5],[.33,-.47],[.43,-.3],[.49,.27],[.5,.43],[.49,.49],[.46,.5],[.43,.46],[.42,.28],[.35,-.12],[.23,-.3],[0,-.32]]
  geometry=new LatheGeometry(profile.map(([x,y])=>new Vector2(x,y)),preview?16:48)
 }else{
  const shape=new Shape(),angle=Math.PI*.39,steps=24
  for(let i=0;i<=steps;i++){const t=-angle+2*angle*i/steps,x=Math.sin(t)*.5,z=-Math.cos(t)*.5;i?shape.lineTo(x,z):shape.moveTo(x,z)}
  for(let i=steps;i>=0;i--){const t=-angle+2*angle*i/steps;shape.lineTo(Math.sin(t)*.45,-Math.cos(t)*.45)}
  shape.closePath();geometry=new ExtrudeGeometry(shape,{depth:1,bevelEnabled:false,curveSegments:24}).rotateX(-Math.PI/2)
  geometry.computeBoundingBox();const box=geometry.boundingBox!,span=box.max.clone().sub(box.min),center=box.min.clone().add(box.max).multiplyScalar(.5)
  geometry.translate(-center.x,-center.y,-center.z).scale(1/span.x,1/span.y,1/span.z)
 }
 geometry.computeBoundingBox();geometry.computeBoundingSphere()
 return geometry
}
