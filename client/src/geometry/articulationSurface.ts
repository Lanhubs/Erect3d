import {ExtrudeGeometry,Shape,Matrix4} from 'three'
import {mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js'
import type {ArticulationSystem} from '../domain/buildingSystems'
import {systemMassGeometry} from './systemMass'
import {articulationPath} from './articulationPath'
export function articulationSurface(system:ArticulationSystem,top=false){
  if(system.profile!=='arch'){
    const {footprint,holes}=articulationPath(system);if(!footprint)return null
    return systemMassGeometry({...system,kind:'massing',role:'wing',polygon:footprint,holes,height:system.thickness,
      elevation:system.elevation+(top?system.height:0)})
  }
  const [a,b]=system.path,length=Math.hypot(b.x-a.x,b.z-a.z),radius=length/2,inner=radius-system.thickness,spring=system.height-radius
  const shape=new Shape();shape.moveTo(-radius,0);shape.lineTo(-radius,spring)
  shape.absarc(0,spring,radius,Math.PI,0,true);shape.lineTo(radius,0);shape.lineTo(inner,0);shape.lineTo(inner,spring)
  shape.absarc(0,spring,inner,0,Math.PI,false);shape.lineTo(-inner,0);shape.closePath()
  const raw=new ExtrudeGeometry(shape,{depth:system.depth,bevelEnabled:false,curveSegments:32})
  if(system.side==='right')raw.translate(0,0,-system.depth)
  raw.applyMatrix4(new Matrix4().makeRotationY(-Math.atan2(b.z-a.z,b.x-a.x)))
  raw.translate((a.x+b.x)/2,system.elevation,(a.z+b.z)/2)
  const geometry=mergeVertices(raw);raw.dispose();geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry
}
