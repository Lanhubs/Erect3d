import type {Level,Stair} from './types'
import type {ArenaLayout} from '../geometry/arenaLayout'
import type {VisionBrief} from '../../../api/src/contracts/vision'
import {facade,type ArchitectureId} from './arenaParts'
import {newSlab} from './levels'
import {stairPlacementValid} from '../geometry/stairPlacement'
import {stairOpening} from '../geometry/stairs'
import {containsPoint} from '../geometry/polygons'
export function arenaTowers(ground:Level,gallery:Level,layout:ArenaLayout,brief:VisionBrief,id:ArchitectureId,shellIds:ReadonlySet<string>) {
  const size=Math.min(8.5,Math.max(8,Math.min(layout.radiusX,layout.radiusZ)*.21))
  const centers=[[-.7,-.7],[.7,-.7],[-.7,.7],[.7,.7]].slice(0,brief.towerCount)
  ground.details ||= [];ground.columns ||= [];ground.slabs ||= []
  centers.forEach(([x,z],index)=>{
    const cx=x*layout.radiusX,cz=z*layout.radiusZ,key=`tower:${index}`
    const polygon=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([a,b])=>layout.world(cx+a*size/2,cz+b*size/2))
    for(const level of [ground,gallery]){
      const covered=new Set(level.walls.filter(wall=>shellIds.has(wall.id) && containsPoint(polygon,{x:(wall.start.x+wall.end.x)/2,z:(wall.start.z+wall.end.z)/2})).map(wall=>wall.id))
      level.walls=level.walls.filter(wall=>!covered.has(wall.id));level.windows=level.windows.filter(window=>!covered.has(window.wallId));level.doors=level.doors.filter(door=>!covered.has(door.wallId))
    }
    const inwardSide=Math.abs(cx)>Math.abs(cz)?cx>0?3:1:cz>0?0:2
    facade(ground,polygon,brief.concourseElevation,brief,id,key,true,inwardSide)
    facade(gallery,polygon,brief.towerHeight-brief.concourseElevation,brief,id,`${key}:upper-facade`,true,inwardSide)
    ground.rooms.push({id:id(`${key}:lobby`),name:`Inferred circulation tower ${index+1}`,polygon,material:'marble',category:'lobby'})
    const base=newSlab(polygon,.25);base.id=id(`${key}:base`);base.autoFromWalls=false;ground.slabs!.push(base)
    const upper=newSlab(polygon,.25);upper.id=id(`${key}:landing`);upper.autoFromWalls=false;gallery.slabs!.push(upper)
    gallery.rooms.push({id:id(`${key}:upper`),name:`Tower ${index+1} concourse landing`,polygon,material:'marble',category:'lobby'})
    polygon.forEach((position,corner)=>ground.columns!.push({id:id(`${key}:column:${corner}`),position,shape:'rectangular',width:.3,depth:.3,diameter:.3,height:brief.towerHeight,material:'steel'}))
    for(let floor=3.2;floor<brief.towerHeight-.5;floor+=3.2){
      polygon.forEach((start,side)=>ground.details!.push({id:id(`${key}:band:${floor}:${side}`),name:'Inferred tower floor band',kind:'canopy',start,end:polygon[(side+1)%4],
        baseElevation:floor,height:.18,depth:.2,spacing:1,material:'concrete',color:brief.facadeColor}))
    }
    const cap=newSlab(polygon,.22);cap.id=id(`${key}:cap`);cap.elevation=brief.towerHeight;cap.autoFromWalls=false;ground.slabs!.push(cap)
    const stair:Stair={id:id(`${key}:stair`),openingId:id(`${key}:opening`),fromLevelId:ground.id,toLevelId:gallery.id,
      start:layout.world(cx-size*.38,cz-size*.14),direction:layout.rotation*180/Math.PI,form:'U',width:1.2,riserHeight:.17,treadDepth:.28,landingLength:1.2}
    // The connection belongs to this tower. Do not search unrelated rooms and
    // silently move circulation elsewhere when its footprint is obstructed.
    let fitted:Stair|undefined
    for(const turn of [0,1,2,3])for(const along of [0,-.55,.55])for(const across of [0,-.55,.55]){
      if(fitted)continue
      const angle=turn*Math.PI/2,run=(Math.ceil(Math.round((gallery.elevation-ground.elevation)/stair.riserHeight)/2)*stair.treadDepth+stair.landingLength)/2
      const localX=(-run+along)*Math.cos(angle)+(stair.width+stair.landingLength)/2*Math.sin(angle)+across*-Math.sin(angle)
      const localZ=(-run+along)*Math.sin(angle)-(stair.width+stair.landingLength)/2*Math.cos(angle)+across*Math.cos(angle)
      const option={...stair,start:layout.world(cx+localX,cz+localZ),direction:(layout.rotation+angle)*180/Math.PI}
      if(stairPlacementValid(option,[ground,gallery],[upper]))fitted=option
    }
    if(fitted){
      ground.stairs ||= [];ground.stairs.push(fitted)
      upper.openings.push({id:fitted.openingId!,kind:'stair',polygon:stairOpening(fitted,[ground,gallery])})
    }else{
      brief.assumptions=[...brief.assumptions,`Tower ${index+1} stair connection needs a footprint review.`].slice(0,12)
    }
  })
}
