import {makeLevel,p,room,createWall} from './sampleHelpers'
import {uid,type Level,type Point} from './types'
import {newFurniture} from '../furniture/entities'
import type {FurnitureType} from '../furniture/types'

export const towerRing=(x:number,z:number,cut=2):Point[]=>[p(-x+cut,-z),p(x-cut,-z),p(x,-z+cut),p(x,z-cut),p(x-cut,z),p(-x+cut,z),p(-x,z-cut),p(-x,-z+cut)]
export const rectangle=(x1:number,z1:number,x2:number,z2:number)=>[p(x1,z1),p(x2,z1),p(x2,z2),p(x1,z2)]
export const liftWells=[-4.2,-1,2.2].map(x=>rectangle(x,-4.4,x+2,-1.8))

export function placeTowerFurniture(level:Level,type:FurnitureType,x:number,z:number,rotation=0,width?:number){
  const object=newFurniture(level,type,p(x,z));object.rotation=rotation
  if(width)object.width=width
  object.materialOverrides={finish:['toilet','bathroom-sink','sink'].includes(type)?'ceramic':['desk','dining-table','coffee-table','kitchen-cabinet'].includes(type)?'timber':'fabric',color:type==='sofa'?'#637f86':undefined}
  level.furniture!.push(object)
  return object
}
function meeting(level:Level,x:number,z:number){
  placeTowerFurniture(level,'dining-table',x,z,0,2.8)
  for(const dx of [-.9,0,.9])for(const dz of [-1,1])placeTowerFurniture(level,'office-chair',x+dx,z+dz,dz<0?180:0)
}
function lounge(level:Level,x:number,z:number){
  placeTowerFurniture(level,'sofa',x,z,0,2.3);placeTowerFurniture(level,'coffee-table',x,z-1.3)
  for(const dx of [-1.5,1.5])placeTowerFurniture(level,'armchair',x+dx,z-2.6,180)
}
function partition(level:Level,a:Point,b:Point,door=true){
  const wall=createWall(a,b,level.floorToFloorHeight!-.24,.16,'interior');level.walls.push(wall)
  const length=Math.hypot(b.x-a.x,b.z-a.z)
  if(door&&length>=2)level.doors.push({id:uid('door'),wallId:wall.id,offset:length/2-.5,width:1,height:2.3,hinge:'left',style:'glazed'})
  return wall
}
export function towerLayout(name:string,elevation:number,outline:Point[],height:number,program:'lobby'|'conference'|'amenities'|'office'|'sky'|'executive'){
  const level=makeLevel(name,elevation,outline,[])
  level.floorToFloorHeight=height;level.autoRoof=false;level.furniture=[]
  level.slabs!.forEach(slab=>{slab.autoFromWalls=false})
  level.walls.forEach(wall=>{wall.height=height-.24;wall.material='concrete';wall.color='#dedbd2'})
  const edge=Math.max(...outline.map(point=>point.x)),back=Math.max(...outline.map(point=>point.z))
  level.rooms=[room('Lift lobby and circulation',rectangle(-6.2,-5.5,6.2,6.5),'marble','circulation'),
    room(program==='lobby'?'Reception and arrival':program==='sky'?'Sky lounge':program==='executive'?'Executive lounge':'Meeting and collaboration',rectangle(-edge+1,-back+2,edge-1,-5.5),'oak','office'),
    room('West workspace',rectangle(-edge+1,-5.5,-12.2,back-1),'carpet','office'),
    room('East workspace',rectangle(12.2,-5.5,edge-1,back-1),'carpet','office'),
    room('West stair core',rectangle(-12.2,-5.5,-6.2,6.5),'concrete','circulation'),
    room('East stair core',rectangle(6.2,-5.5,12.2,6.5),'concrete','circulation'),
    room('Accessible WC',rectangle(6.2,6.5,12.2,back-1),'porcelain-tile','bathroom'),
    room('Washrooms',rectangle(-12.2,6.5,-6.2,back-1),'porcelain-tile','bathroom'),
    room('Rear circulation',rectangle(-6.2,6.5,6.2,back-1),'marble','circulation')].map(plan=>({...plan,id:uid('room')}))
  for(const [a,b,door] of [[p(-6,-5),p(6,-5),false],[p(-6,-5),p(-6,6),true],[p(6,-5),p(6,6),true],[p(-6,6),p(6,6),true]] as [Point,Point,boolean][])partition(level,a,b,door)
  for(const x of [-12,-7,7,12])partition(level,p(x,7),p(x,back-1),false)
  for(const x of [-12,7])partition(level,p(x,7),p(x+5,7))
  level.stairGuides=[]
  for(const ring of [rectangle(-11,-2,-6.5,6),rectangle(6.5,-2,11,6)]){
    ring.forEach((a,i)=>partition(level,a,ring[(i+1)%4],i===2))
    level.stairGuides.push({id:uid('guide'),polygon:ring,evidence:'Aligned enclosed stair core; tower flights are architectural guides, podium flights connect real levels.'})
  }
  for(const well of liftWells){
    level.slabs![0].openings.push({id:uid('opening'),kind:'shaft',polygon:structuredClone(well)})
    for(let i=0;i<well.length;i++){
      const wall=partition(level,well[i],well[(i+1)%well.length],i===2)
      const door=level.doors.find(item=>item.wallId===wall.id)
      if(door){door.style='flush';door.material='metal'}
    }
  }
  for(const x of [-10.5,8.5]){
    placeTowerFurniture(level,'toilet',x,back-2.2);placeTowerFurniture(level,'bathroom-sink',x+1,8.2)
  }
  for(const x of [-edge+3,edge-3])for(const z of [-back+3,0,back-3]){
    level.columns!.push({id:uid('column'),position:p(x,z),shape:'circular',diameter:.65,width:.65,depth:.65,height:height-.24,material:'concrete'})
  }
  if(program==='office'){
    for(const side of [-1,1])for(const z of [-3,2,8])for(const x of edge>16?[13.5,16.5]:[13.5]){
      placeTowerFurniture(level,'desk',side*x,z,side<0?90:270)
      placeTowerFurniture(level,'office-chair',side*(x-1),z,side<0?90:270)
    }
    meeting(level,0,-back+3.5)
  }else if(program==='lobby'){
    placeTowerFurniture(level,'desk',-10,-10,0,3.6);lounge(level,-17,-12);lounge(level,15,-12)
    meeting(level,17,3)
  }else if(program==='conference'){
    for(const x of [-17,17])for(const z of [-9,3])meeting(level,x,z)
  }else if(program==='amenities'){
    lounge(level,-17,-9);meeting(level,16,-8)
    placeTowerFurniture(level,'kitchen-cabinet',16,4,0,4);placeTowerFurniture(level,'refrigerator',21,4)
  }else{
    lounge(level,-10,-8);meeting(level,9,-8)
    if(program==='executive'){placeTowerFurniture(level,'desk',-10,1);placeTowerFurniture(level,'office-chair',-10,2.1)}
  }
  const entry=level.walls[0],length=Math.hypot(entry.end.x-entry.start.x,entry.end.z-entry.start.z)
  if(program==='lobby'||program==='sky'||program==='executive')level.doors.push({id:uid('door'),wallId:entry.id,offset:length/2-1.4,width:2.8,height:3,hinge:'left',style:'double',leafStyle:'glazed',material:'metal'})
  return level
}
