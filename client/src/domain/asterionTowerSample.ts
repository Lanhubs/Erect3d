import {defaultRoof,type Project} from './types'
import {makeProject,p,linkStair} from './sampleHelpers'
import {newSlab} from './levels'
import {rectangle,towerLayout,towerRing} from './asterionLayouts'
import {towerCrown,towerDetail,towerFacade,towerFloors,towerRoof,perimeterDetails,terraceGuards} from './asterionArchitecture'

// Deterministic geometry and semantic IDs; separate backend projects own their
// independent copies. IDs and all references are renamed in two passes.
function stableIds(project:Project){
  const ids=new Map<string,string>()
  const collect=(value:unknown):void=>{
    if(!value||typeof value!=='object')return
    if('id' in value&&typeof value.id==='string')ids.set(value.id,`asterion_${value.id.split('_')[0]}_${ids.size}`)
    Object.values(value).forEach(collect)
  }
  const rename=(value:unknown):unknown=>typeof value==='string'?ids.get(value)||value:Array.isArray(value)?value.map(rename):
    value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([key,item])=>[key,rename(item)])):value
  collect(project);return rename(project) as Project
}
export function asterionTowerSample():Project{
  const podium=rectangle(-27,-21,27,21),lower=towerRing(19,16),upper=towerRing(15,14)
  const ground=towerLayout('01 · Arrival lobby',0,podium,5.4,'lobby')
  const conference=towerLayout('02 · Conference podium',5.4,podium,4.2,'conference')
  const amenities=towerLayout('03 · Business club',9.6,podium,4.2,'amenities')
  const low=towerLayout('04–24 · Lower office template',13.8,lower,3.6,'office')
  const sky=towerLayout('25 · Sky lounge and terraces',89.4,upper,5.4,'sky')
  sky.slabs![0].polygon=structuredClone(lower)
  const high=towerLayout('26–47 · Upper office template',94.8,upper,3.6,'office')
  const executive=towerLayout('48 · Executive floor',174,upper,5.4,'executive')
  ground.slabs!.push({...newSlab(rectangle(-27,-31,27,-21)),autoFromWalls:false,finishMaterial:'polished-concrete'})
  // Aligned podium flights use actual destination levels and reviewed openings.
  linkStair(ground,conference,p(-10,5),270,'U')
  linkStair(conference,amenities,p(-10,5),270,'U')
  const levels=[ground,conference,amenities,low,sky,high,executive]
  const project=makeProject('Asterion Tower · 48-storey office skyscraper','Asterion Tower',levels,
    {...defaultRoof,shape:'terrace',material:'membrane',pitch:0,overhang:0})
  project.modified=0
  const building=project.buildings[0]
  building.systems={version:1,typology:'office-tower',systems:[
    towerFloors(low,21,'Lower offices · storeys 04–24'),towerFloors(high,22,'Upper offices · storeys 26–47'),
    ...[[ground,podium,5.4],[conference,podium,4.2],[amenities,podium,4.2],[low,lower,75.6],[sky,upper,5.4],[high,upper,79.2],[executive,upper,5.4]].map(([level,ring,height])=>towerFacade(level as typeof ground,ring as typeof podium,height as number,level!==low&&level!==high)),
    ...[ground,conference,amenities,low,high,executive].flatMap(level=>perimeterDetails(level,level===low?lower:level===high||level===executive?upper:podium,'cornice',.28,level.floorToFloorHeight!-.28,level===low||level===high)),
    ...[low,high].flatMap(level=>perimeterDetails(level,level===low?lower:upper,'fins',level.floorToFloorHeight!,0,true)),
    ...terraceGuards(amenities,podium).map(guard=>({...guard,elevation:4.25})),...terraceGuards(sky,lower),
    {...towerDetail(ground,'Entrance canopy','canopy',p(-9,-21),p(9,-21),4.2,0,5),footprint:rectangle(-9,-26,9,-21)},
    towerDetail(ground,'Canopy columns','colonnade',p(-8,-25),p(8,-25),4.2,0,.5,8),
    ...towerCrown(executive),
  ]}
  building.roofSections=[towerRoof(ground,'Podium terrace and soffit',podium,13.8,[lower]),towerRoof(executive,'Tower roof deck',upper,5.4),
    towerRoof(executive,'Mechanical crown cap',rectangle(-7,-6,7,6),12.6)]
  building.walkViewpoints=[{id:'asterion_lobby_view',name:'Arrival lobby',levelId:ground.id,point:p(0,-16),foot:0,yaw:Math.PI,pitch:0},
    {id:'asterion_sky_view',name:'Sky terrace',levelId:sky.id,point:p(0,-15),foot:89.4,yaw:Math.PI,pitch:0}]
  // The continuous curtain-wall systems own the tower shell. Repeated/detached
  // layouts own their interiors, avoiding opaque duplicate walls behind glazing.
  low.walls=low.walls.slice(lower.length);high.walls=high.walls.slice(upper.length)
  return stableIds(project)
}
