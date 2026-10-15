import {DoubleSide} from 'three'
import type {Room} from '../domain/types'
// Court markings are a surface finish, with no collidable wall geometry.
export function BasketballCourt({room}:{room:Room}) {
  const xs=room.polygon.map(point=>point.x),zs=room.polygon.map(point=>point.z)
  const minX=Math.min(...xs),maxX=Math.max(...xs),minZ=Math.min(...zs),maxZ=Math.max(...zs)
  const w=maxX-minX,d=maxZ-minZ,cx=(minX+maxX)/2,cz=(minZ+maxZ)/2,scale=Math.min(w/28,d/15)
  if(scale<=0 || !Number.isFinite(scale))return null
  const color='#28455c',stroke=Math.max(.025,.05*scale),y=.069
  const line=(a:number,b:number,c:number,e:number,key:string)=>{
    const length=Math.hypot(c-a,e-b)
    return <mesh key={key} position={[(a+c)/2,y,(b+e)/2]} rotation={[0,-Math.atan2(e-b,c-a),0]}>
      <boxGeometry args={[length,.008,stroke]}/><meshBasicMaterial color={color}/></mesh>
  }
  const ring=(x:number,r:number,key:string,start=0,sweep=Math.PI*2)=><mesh key={key} position={[x,y,cz]} rotation={[-Math.PI/2,0,0]}>
    <ringGeometry args={[Math.max(0,r-stroke/2),r+stroke/2,64,1,start,sweep]}/><meshBasicMaterial color={color} side={DoubleSide}/></mesh>
  return <group name="basketball-court-markings">
    {line(minX,minZ,maxX,minZ,'north')}{line(maxX,minZ,maxX,maxZ,'east')}{line(maxX,maxZ,minX,maxZ,'south')}{line(minX,maxZ,minX,minZ,'west')}
    {line(cx,minZ,cx,maxZ,'half')}{ring(cx,1.8*scale,'center')}
    {[0,1].map(side=>{
      const baseline=side?maxX:minX,free=baseline+(side?-1:1)*5.8*scale,basket=baseline+(side?-1:1)*1.575*scale
      return <group key={side}>
        {line(baseline,cz-2.45*scale,free,cz-2.45*scale,'lane-north')}{line(free,cz-2.45*scale,free,cz+2.45*scale,'free-throw')}
        {line(free,cz+2.45*scale,baseline,cz+2.45*scale,'lane-south')}{ring(free,1.8*scale,'free-circle')}
        {ring(basket,6.75*scale,'three-point',side?Math.PI/2:-Math.PI/2,Math.PI)}
        {ring(basket,1.25*scale,'restricted',side?Math.PI/2:-Math.PI/2,Math.PI)}
      </group>
    })}
  </group>
}
