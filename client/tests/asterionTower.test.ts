import {expect,test} from 'bun:test'
import {asterionTowerSample} from '../src/domain/asterionTowerSample'
import {representedStoreys,buildingLevelLabel} from '../src/domain/storeys'
import {detachTypicalFloor,linkedFloorIndices} from '../src/domain/typicalFloors'
import {projectSchema} from '../../api/src/contracts/project'
import {validateGeometry} from '../../api/src/modules/projects/geometry-validation'
import {compileBuildingSystems,architecturalBounds} from '../src/geometry/systemCompiler'
import {containsPolygon} from '../src/geometry/polygons'
import {stairOpening} from '../src/geometry/stairs'
import {furnitureIssues} from '../src/furniture/entities'
import {normalizeProject} from '../src/domain/levels'
import {useProject} from '../src/state/project'
import {createSampleLibrary} from '../src/domain/sampleLibrary'
import {roofElevation} from '../src/geometry/roofElevation'

test('the authored skyscraper represents 48 storeys with seven editable layouts and stable serializable identities',()=>{
  const project=asterionTowerSample(),building=project.buildings[0]
  expect(project).toEqual(asterionTowerSample());expect(projectSchema.safeParse(project).success).toBe(true)
  expect(()=>validateGeometry(project)).not.toThrow();expect(building.levels).toHaveLength(7)
  expect(representedStoreys(building)).toBe(48);expect(buildingLevelLabel(building)).toBe('48 storeys · 7 editable layouts')
  expect(building.levels.map(level=>level.elevation)).toEqual([0,5.4,9.6,13.8,89.4,94.8,174])
  const groups=building.systems!.systems.filter(system=>system.kind==='typical-floors')
  expect(groups.map(group=>group.count)).toEqual([21,22])
  expect(groups.map(group=>linkedFloorIndices(building,group).length)).toEqual([20,21])
  expect(architecturalBounds(building).top).toBeCloseTo(186.85) // Blade-screen coping; roof parapets are measured separately.
  expect(roofElevation(building.roofSections!,building.levels)).toBeCloseTo(187.275)
  expect(normalizeProject(JSON.parse(JSON.stringify(project)))).toMatchObject({buildings:[{levels:expect.any(Array)}]})
  expect(JSON.stringify(project).length).toBeLessThan(250_000)
})

test('furniture stays on floors, shafts remain aligned and podium stairs fit their actual circulation cores',()=>{
  const building=asterionTowerSample().buildings[0],wellPolygons=building.levels[0].slabs![0].openings.filter(opening=>opening.kind==='shaft').map(opening=>opening.polygon)
  for(const level of building.levels){
    expect(level.furniture!.length).toBeGreaterThan(10)
    expect(level.slabs![0].openings.filter(opening=>opening.kind==='shaft').map(opening=>opening.polygon)).toEqual(wellPolygons)
    for(const object of level.furniture!)expect(furnitureIssues(object,level,building.levels).issues).toEqual([])
    for(const stair of level.stairs!){
      expect(level.stairGuides?.some(guide=>containsPolygon(guide.polygon,stairOpening(stair,building.levels)))).toBe(true)
      expect(building.levels.find(target=>target.id===stair.toLevelId)!.slabs!.some(slab=>slab.openings.some(opening=>opening.id===stair.openingId))).toBe(true)
    }
  }
  expect(building.levels.slice(0,2).every(level=>level.stairs!.length===1)).toBe(true)
})

test('facades own disjoint vertical bands and crown, terrace and detail packages compile with finite dimensions',()=>{
  const building=asterionTowerSample().buildings[0],compiled=compileBuildingSystems(building)
  expect(compiled.errors).toEqual([])
  const facades=building.systems!.systems.filter(system=>system.kind==='curtain-wall')
  for(let index=1;index<facades.length;index++){
    const prior=facades[index-1],base=building.levels.find(level=>level.id===prior.levelId)!.elevation
    expect(base+prior.elevation+prior.height).toBeCloseTo(building.levels.find(level=>level.id===facades[index].levelId)!.elevation)
  }
  for(const pack of compiled.packages)for(const part of [...pack.parts,...pack.glass,...pack.frame,...(pack.articulation?Object.values(pack.articulation).flat():[])]){
    expect([...part.center,...part.size].every(Number.isFinite)).toBe(true);expect(part.size.every(size=>size>0)).toBe(true)
  }
  expect(building.roofSections).toHaveLength(3)
  expect(building.roofSections![0].voids).toHaveLength(1)
  const officeIds=new Set(building.levels.filter(level=>level.name.includes('office template')).map(level=>level.id))
  const fins=building.systems!.systems.filter(system=>system.kind==='articulation'&&system.profile==='fins'&&officeIds.has(system.levelId))
  expect(fins).toHaveLength(16)
  for(const fin of fins){expect(fin.repeatWithFloor).toBe(true);expect(fin.height).toBe(3.6)}
})

test('detaching a linked floor preserves 48 storeys and independent edits survive Undo and serialization',()=>{
  const project=asterionTowerSample(),building=project.buildings[0],group=building.systems!.systems.find(system=>system.kind==='typical-floors')!
  const detached=detachTypicalFloor(project,building.id,group.id,10),copy=detached.buildings[0],floor=copy.levels.at(-1)!
  expect(floor.elevation).toBeCloseTo(49.8);expect(representedStoreys(copy)).toBe(48)
  expect(buildingLevelLabel(copy)).toBe('48 storeys · 8 editable layouts')
  expect(()=>validateGeometry(detached)).not.toThrow()
  const store=useProject.getState();store.setReadOnly(false);store.setProject(detached)
  const templateName=copy.levels.find(level=>level.id===group.templateLevelId)!.rooms[0].name
  store.editProject(next=>{next.buildings[0].levels.find(level=>level.id===floor.id)!.rooms[0].name='Independent tenant';return next})
  expect(useProject.getState().project!.buildings[0].levels.find(level=>level.id===group.templateLevelId)!.rooms[0].name).toBe(templateName)
  store.undo();expect(useProject.getState().project!.buildings[0].levels.find(level=>level.id===floor.id)!.rooms[0].name).not.toBe('Independent tenant')
  store.redo();expect(projectSchema.safeParse(JSON.parse(JSON.stringify(useProject.getState().project))).success).toBe(true)
  store.setProject(null)
})

test('a duplicate elevation is counted once and skyscraper presentation metadata is optional for older samples',()=>{
  const building=asterionTowerSample().buildings[0]
  building.levels.push({...structuredClone(building.levels[0]),id:'other-layout-same-elevation'})
  expect(representedStoreys(building)).toBe(48)
  const samples=createSampleLibrary(),tower=samples.find(sample=>sample.id==='asterion-tower')!
  expect(tower.preferredView).toBe('model');expect(tower.previewImage).toBe('/samples/asterion-tower.webp')
  expect(samples.find(sample=>sample.id==='house')!.preferredView).toBeUndefined()
})
test('editing a curtain-walled office template preserves its full authored floor deck',()=>{
  const project=asterionTowerSample(),building=project.buildings[0],template=building.levels[3],outline=structuredClone(template.slabs![0].polygon)
  const store=useProject.getState();store.setReadOnly(false);store.setProject(project);store.setActiveLevel(template.id)
  store.edit(model=>({...model,walls:model.walls.map((wall,index)=>index?wall:{...wall,height:wall.height+.05})}))
  const updated=useProject.getState().project!.buildings[0]
  expect(updated.levels.find(level=>level.id===template.id)!.slabs![0].polygon).toEqual(outline)
  expect(representedStoreys(updated)).toBe(48);expect(()=>validateGeometry(useProject.getState().project!)).not.toThrow()
  store.undo();expect(useProject.getState().project!.buildings[0].levels[3].walls[0].height).toBe(template.walls[0].height)
  store.setProject(null)
})
