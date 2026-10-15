import {ExtrudeGeometry,Path,Shape} from 'three'
import {mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js'
import type {MassingSystem} from '../domain/buildingSystems'
export function systemMassGeometry(system:MassingSystem){
  const shape=new Shape()
  system.polygon.forEach((p,i)=>i?shape.lineTo(p.x,-p.z):shape.moveTo(p.x,-p.z));shape.closePath()
  for(const ring of system.holes){const hole=new Path();ring.forEach((p,i)=>i?hole.lineTo(p.x,-p.z):hole.moveTo(p.x,-p.z));hole.closePath();shape.holes.push(hole)}
  const raw=new ExtrudeGeometry(shape,{depth:system.height,bevelEnabled:false})
  raw.rotateX(-Math.PI/2);raw.translate(0,system.elevation,0)
  const geometry=mergeVertices(raw);raw.dispose();geometry.computeBoundingBox();geometry.computeBoundingSphere()
  return geometry
}
