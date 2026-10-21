import {blankLevel} from '../domain/levels'
import type {Project,Point} from '../domain/types'
import {newFurniture} from './entities'
import type {FurnitureType} from './types'
// Authored visual fixture. This is deliberately separate from AI/source fidelity.
export function furnitureValidationScene():Project{
 const level=blankLevel('Furniture studio',0,3),p=(x:number,z:number):Point=>({x,z})
 level.id='furniture-studio';level.autoRoof=false;level.autoSlab=false
 level.rooms=[{id:'studio-floor',name:'Authored furniture study',material:'oak',polygon:[p(0,0),p(9,0),p(9,8),p(0,8)]}]
 level.walls=[{id:'studio-back',start:p(0,0),end:p(9,0),height:2.6,thickness:.18,material:'plaster'},
  {id:'studio-side',start:p(0,0),end:p(0,8),height:2.6,thickness:.18,material:'plaster'}]
 level.windows=[{id:'studio-window',wallId:'studio-back',offset:3.4,width:3,height:1.8,sill:.55}]
 const at=(type:FurnitureType,x:number,z:number,rotation=0,assetId?:string)=>{
  const object=newFurniture(level,type,p(x,z));object.id=`study-${level.furniture?.length||0}`;object.rotation=rotation
  if(assetId)object.assetId=assetId
  ;(level.furniture||=[]).push(object);return object
 }
 at('bed',1.6,1.65,0,'queen');at('bedside-table',.45,1.05);at('bedside-table',2.7,1.05)
 at('sofa',5.4,1.4,0,'3-seat');at('coffee-table',5.4,2.8,0,'oval');at('armchair',7.5,2.3,-55)
 at('dining-table',5.3,5.25,0,'round')
 for(let i=0;i<4;i++){const a=i*Math.PI/2;at('dining-chair',5.3+Math.sin(a)*1.05,5.25+Math.cos(a)*1.05,180-i*90)}
 at('bathtub',1,5.7);at('bathroom-sink',2.4,4.7);at('toilet',2.7,6.2);at('shower',1,7.25)
 at('kitchen-island',7.7,5.9,90);at('cooker',8.5,4.6);at('refrigerator',8.4,3.6)
 return {id:'furniture-study',name:'Authored furniture studio',modified:0,units:'m',sources:[],buildings:[{id:'furniture-building',name:'Studio',levels:[level]}]}
}
