import type {Level,Point,SeatingSection} from './types'
import type {ArenaLayout} from '../geometry/arenaLayout'
import type {VisionBrief} from '../../../api/src/contracts/vision'
export type ArchitectureId=(key:string)=>string
export function facade(level:Level,ring:Point[],height:number,brief:VisionBrief,id:ArchitectureId,key:string,glazed=true,openingSide=2) {
  const created=new Set<string>()
  ring.forEach((start,index)=>{
    const end=ring[(index+1)%ring.length],length=Math.hypot(end.x-start.x,end.z-start.z),wallId=id(`${key}:wall:${index}`)
    created.add(wallId)
    level.walls.push({id:wallId,start,end,height,thickness:.28,kind:'exterior',material:'concrete',color:brief.facadeColor})
    if(glazed && length>.8)level.windows.push({id:id(`${key}:glass:${index}`),wallId,offset:.18,width:length-.36,
      sill:Math.min(.65,height*.1),height:height-Math.min(.65,height*.1)-.25,frame:'aluminium',type:'fixed',glazing:'clear'})
    if((key==='lower-facade' && index===Math.floor(ring.length/4) || key.startsWith('tower:') && index===openingSide) && length>3.5){
      level.doors.push({id:id(`${key}:entrance:${index}`),wallId,offset:(length-3)/2,width:3,height:2.8,hinge:'left',style:'double',material:'metal'})
      const window=level.windows.find(item=>item.wallId===wallId)
      if(window){window.sill=3;window.height=height-3.25}
    }
  })
  return created
}
export function bowl(layout:ArenaLayout,brief:VisionBrief,id:ArchitectureId):SeatingSection[] {
  // Short tangent banks form a curved bowl and remain ordinary editable seats.
  return Array.from({length:24},(_,index)=>{
    const t=index/24*Math.PI*2,half=Math.PI/24*.83
    const start=layout.world(layout.innerX*Math.cos(t-half),layout.innerZ*Math.sin(t-half))
    const end=layout.world(layout.innerX*Math.cos(t+half),layout.innerZ*Math.sin(t+half))
    const normal=layout.world(Math.cos(t)/layout.innerX,Math.sin(t)/layout.innerZ)
    const outward={x:normal.x-layout.center.x,z:normal.z-layout.center.z},n=Math.hypot(outward.x,outward.z)
    const innerLength=Math.hypot(end.x-start.x,end.z-start.z),spread=layout.rows*.82
    const outerA=layout.world((layout.innerX+spread)*Math.cos(t-half),(layout.innerZ+spread)*Math.sin(t-half))
    const outerB=layout.world((layout.innerX+spread)*Math.cos(t+half),(layout.innerZ+spread)*Math.sin(t+half))
    return {id:id(`bowl:${index}`),name:`Inferred spectator bank ${index+1}`,start,end,outward:{x:outward.x/n,z:outward.z/n},
      rows:layout.rows,seatsPerRow:Math.max(4,Math.floor(Math.hypot(end.x-start.x,end.z-start.z)/.52)),
      rowDepth:.82,rowRise:.34,baseElevation:.2,seatColor:brief.seatColor,
      rowWidthGrowth:Math.max(0,(Math.hypot(outerB.x-outerA.x,outerB.z-outerA.z)-innerLength)/layout.rows)}
  })
}
export function rails(level:Level,ring:Point[],id:ArchitectureId,key:string) {
  level.details ||= []
  ring.forEach((start,index)=>level.details!.push({id:id(`${key}:${index}`),name:'Inferred concourse balustrade',kind:'railing',start,end:ring[(index+1)%ring.length],
    baseElevation:0,height:1.2,depth:.08,spacing:1.4,material:'glass',color:'#b9ced2'}))
}
