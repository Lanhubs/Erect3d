import type {Project} from './types'
import type {VisionBrief} from '../../../api/src/contracts/vision'
import {visionSchema} from '../../../api/src/contracts/vision'
import {defaultArenaVision,type ArchitectureVision} from './architectureTypes'
import {arenaLayout} from '../geometry/arenaLayout'
import {bowl,facade,rails,type ArchitectureId} from './arenaParts'
import {arenaTowers} from './arenaTowers'
import {newSlab} from './levels'
import {generatedRoof} from './roofDesign'
import {containsPoint} from '../geometry/polygons'
import {repairGeneratedFence} from '../geometry/site'
export function removeArchitecture(project:Project,buildingId:string) {
  const building=project.buildings.find(item=>item.id===buildingId)!,vision=building.architecture
  if(!vision)return
  const ids=new Set(vision.generatedIds),levels=new Set(vision.generatedLevelIds)
  building.levels=building.levels.filter(level=>!levels.has(level.id))
  for(const level of building.levels)for(const key of ['walls','doors','windows','passages','rooms','slabs','columns','stairs','ramps','seatingSections','details'] as const){
    if(level[key])Object.assign(level,{[key]:level[key]!.filter(item=>!ids.has(item.id))})
  }
  building.roofSections=building.roofSections?.filter(section=>!ids.has(section.id))
  for(const id of ids)if(project.interpretation)delete project.interpretation[id]
  delete building.architecture
}
export function createArenaArchitecture(input:Project,levelId:string,choice:Partial<VisionBrief>={},makeId?:ArchitectureId,preserveRoof=false) {
  const project=structuredClone(input),building=project.buildings.find(item=>item.levels.some(level=>level.id===levelId))
  if(!building || building.levels.some(level=>level.locked))throw new Error('Unlock the building levels before generating its architectural concept.')
  const previous=building.architecture
  const sourceLevel=building.levels.find(level=>level.id===levelId)
  if(!sourceLevel?.rooms.some(room=>['basketball-court','football-pitch','table-tennis-hall'].includes(room.category || '')))return project
  removeArchitecture(project,building.id)
  const ground=building.levels.find(level=>level.id===levelId)!,court=ground.rooms.find(room=>['basketball-court','football-pitch','table-tennis-hall'].includes(room.category || ''))
  if(!court || court.polygon.length<3)return project
  const brief:VisionBrief={...defaultArenaVision,...previous?.brief,...choice,assumptions:[...(choice.assumptions || previous?.brief.assumptions || defaultArenaVision.assumptions)]}
  if(choice.style && choice.style!==previous?.brief.style){
    const palettes={'civic-modern':['#c5cbd0','#35515d'],'warm-modern':['#d1bfaa','#92613d'],industrial:['#7c858b','#3b4752']}
    brief.facadeColor=choice.facadeColor || palettes[choice.style][0];brief.seatColor=choice.seatColor || palettes[choice.style][1]
  }
  brief.clearance=Math.max(brief.clearance,brief.concourseElevation+3);visionSchema.parse(brief)
  const seed=previous?.id || `concept_${ground.id.slice(0,40)}`,generatedIds:string[]=[]
  const id:ArchitectureId=key=>{const value=makeId?makeId(key):`${seed}_${key}`.slice(0,160);generatedIds.push(value);return value}
  const layout=arenaLayout(ground,court,brief)
  // A labelled playing surface cannot contain detected painted-line walls.
  const paint=ground.walls.filter(wall=>project.interpretation?.[wall.id]?.origin==='detected' && containsPoint(court.polygon,wall.start) && containsPoint(court.polygon,wall.end))
  const paintIds=new Set(paint.map(wall=>wall.id))
  ground.walls=ground.walls.filter(wall=>!paintIds.has(wall.id));ground.doors=ground.doors.filter(door=>!paintIds.has(door.wallId));ground.windows=ground.windows.filter(window=>!paintIds.has(window.wallId))
  ground.passages=ground.passages?.filter(passage=>!paintIds.has(passage.wallId))
  ground.seatingSections=[...(ground.seatingSections || []),...bowl(layout,brief,id)]
  const galleryRing=layout.ellipse(layout.radiusX,layout.radiusZ),bowlRing=layout.ellipse(layout.bowlX,layout.bowlZ)
  const shellIds=facade(ground,galleryRing,brief.concourseElevation,brief,id,'lower-facade')
  let gallery=building.levels.find(level=>level.id!==ground.id && Math.abs(level.elevation-ground.elevation-brief.concourseElevation)<.1)
  const generatedLevelIds:string[]=[]
  if(!gallery){
    gallery={id:id('gallery'),name:'Inferred spectator concourse',elevation:ground.elevation+brief.concourseElevation,floorToFloorHeight:brief.clearance-brief.concourseElevation,
      walls:[],doors:[],windows:[],rooms:[],slabs:[],slabThickness:.25,autoSlab:false,autoRoof:false,columns:[],stairs:[],details:[]}
    building.levels.push(gallery);generatedLevelIds.push(gallery.id)
  }
  gallery.slabs ||= []
  const deck=newSlab(galleryRing,.3);deck.id=id('concourse-deck');deck.autoFromWalls=false
  deck.openings=[{id:id('bowl-opening'),kind:'void',polygon:bowlRing}];gallery.slabs.push(deck)
  gallery.rooms.push({id:id('concourse-room'),name:'Inferred public concourse',polygon:galleryRing,material:'polished-concrete',category:'concourse'})
  facade(gallery,galleryRing,Math.max(2.8,brief.clearance-brief.concourseElevation),brief,id,'upper-facade').forEach(value=>shellIds.add(value))
  rails(gallery,bowlRing,id,'bowl-rail');rails(gallery,galleryRing,id,'outer-rail')
  arenaTowers(ground,gallery,layout,brief,id,shellIds)
  ground.details ||= [];ground.ramps ||= []
  ground.details.push({id:id('entrance-canopy'),name:'Inferred main entrance canopy',kind:'canopy',start:layout.world(-8,layout.radiusZ+.8),end:layout.world(8,layout.radiusZ+.8),baseElevation:0,height:3.6,depth:5,spacing:2,material:'steel',color:'#647783'})
  ground.ramps.push({id:id('entrance-ramp'),start:layout.world(0,layout.radiusZ+7),end:layout.world(0,layout.radiusZ+.1),width:4,thickness:.15,startElevation:-ground.slabThickness,endElevation:0,material:'concrete'})
  const manualRoof=building.roofSections?.some(section=>!generatedRoof(section))
  const roofSectionId=manualRoof?building.roofSections!.find(section=>!generatedRoof(section))!.id:id('canopy')
  if(!manualRoof){
    building.roofSections=(building.roofSections || []).filter(section=>section.levelId!==ground.id || !generatedRoof(section))
    const roof=preserveRoof && building.roof?{...building.roof}:{shape:'arena-vault' as const,material:'standing-seam' as const,color:'#7d8990',pitch:16,overhang:1.5,ridgeDirection:'z' as const}
    building.roofSections.push({id:roofSectionId,name:'Inferred long-span daylight canopy',levelId:ground.id,footprint:galleryRing,topHeight:brief.clearance,automatic:true,followFootprint:true,roof})
    building.roof={...roof};ground.roof={...roof};ground.autoRoof=false
  }
  const vision:ArchitectureVision={id:makeId?makeId('vision'):seed,version:1,kind:'arena',sourceLevelId:ground.id,courtId:court.id,origin:'inferred',brief,
    center:layout.center,radiusX:layout.radiusX,radiusZ:layout.radiusZ,rotation:layout.rotation,roofSectionId,generatedIds:[...new Set(generatedIds)],generatedLevelIds}
  building.architecture=vision
  project.interpretation ||= {}
  for(const entityId of vision.generatedIds)project.interpretation[entityId]={origin:'inferred',confirmedFields:[]}
  repairGeneratedFence(building)
  return project
}
