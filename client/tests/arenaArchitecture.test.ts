import {expect,test} from 'bun:test'
import {basketballArenaSample} from '../src/domain/basketballArenaSample'
import {createArenaArchitecture,removeArchitecture} from '../src/domain/arenaArchitecture'
import {normalizeProject} from '../src/domain/levels'
import {projectSchema} from '../../api/src/contracts/project'
import {arenaCanopyBuffers} from '../src/geometry/arenaCanopyBuffers'
import {canopyParameters} from '../src/geometry/arenaCanopy'
import {facadeWallParts,batchedFacadeIds} from '../src/rendering/ArchitectureFacade'
import {transformElement} from '../src/domain/elementEditing'
import {nextResolution,qualityProfiles} from '../src/rendering/graphicsQuality'
import {validateGeometry} from '../../api/src/modules/projects/geometry-validation'
import {effectiveRoofSections} from '../src/domain/roofCoverage'
function source(){const project=basketballArenaSample(),building=project.buildings[0];building.levels=building.levels.slice(0,1);building.levels[0].stairs=[];building.roofSections=[];return project}
test('arena concept preserves measured entities, persists through API/save and rebuilds without duplicates',()=>{
  const input=source(),before=JSON.stringify(input),levelId=input.buildings[0].levels[0].id
  const concept=createArenaArchitecture(input,levelId),building=concept.buildings[0],vision=building.architecture!
  expect(JSON.stringify(input)).toBe(before)
  expect(building.levels[0].walls.slice(0,input.buildings[0].levels[0].walls.length)).toEqual(input.buildings[0].levels[0].walls)
  expect(vision.brief.towerCount).toBe(4);expect(building.levels.length).toBe(2)
  expect(projectSchema.safeParse(concept).success).toBe(true)
  expect(()=>validateGeometry(concept)).not.toThrow()
  expect(effectiveRoofSections(building).find(section=>section.id===vision.roofSectionId)?.roof.shape).toBe('arena-vault')
  expect(normalizeProject(JSON.parse(JSON.stringify(concept))).buildings[0].architecture).toEqual(vision)
  const rebuilt=createArenaArchitecture(concept,levelId,{roofCoverage:'full',seatingRows:16})
  expect(rebuilt.buildings[0].levels).toHaveLength(2)
  expect(new Set(rebuilt.buildings[0].architecture!.generatedIds).size).toBe(rebuilt.buildings[0].architecture!.generatedIds.length)
  expect(rebuilt.buildings[0].levels[0].walls.length).toBe(building.levels[0].walls.length)
  const removed=structuredClone(rebuilt);removeArchitecture(removed,building.id)
  expect(removed.buildings[0].levels[0].walls).toEqual(input.buildings[0].levels[0].walls)
  expect(removed.buildings[0].levels).toHaveLength(1)
})
test('generated walls remain movable semantic entities and selected openings leave their batch for editing',()=>{
  const input=source(),project=createArenaArchitecture(input,input.buildings[0].levels[0].id),building=project.buildings[0],ground=building.levels[0]
  const window=ground.windows.find(item=>building.architecture!.generatedIds.includes(item.id))!,wall=ground.walls.find(item=>item.id===window.wallId)!
  const ids=new Set(building.architecture!.generatedIds)
  expect(batchedFacadeIds(ground,ids,null).has(wall.id)).toBe(true)
  expect(batchedFacadeIds(ground,ids,{kind:'window',id:window.id}).has(wall.id)).toBe(false)
  const moved=transformElement(project,{kind:'wall',id:wall.id},{move:{x:.3,z:.2}})
  expect(moved.issue).toBeNull();expect(moved.project.buildings[0].levels[0].walls.find(item=>item.id===wall.id)!.start.x).toBeCloseTo(wall.start.x+.3)
  expect(moved.project.buildings[0].roofSections!.some(section=>section.id===building.architecture!.roofSectionId)).toBe(true)
  const unchanged=facadeWallParts(wall,[window]);expect(facadeWallParts(wall,[window])).toBe(unchanged)
  const changed=facadeWallParts(wall,[{...window,width:window.width-.1}]);expect(changed).not.toBe(unchanged)
})
test('full, partial and open canopy buffers have finite indexed surfaces, no degenerate triangles and expected coverage',()=>{
  const input=source(),building=createArenaArchitecture(input,input.buildings[0].levels[0].id).buildings[0],vision=building.architecture!
  for(const coverage of ['full','partial','open'] as const){
    const parameters=canopyParameters({...vision,brief:{...vision.brief,roofCoverage:coverage}},12),buffers=arenaCanopyBuffers(parameters)
    expect([...buffers.positions,...buffers.normals,...buffers.uvs].every(Number.isFinite)).toBe(true)
    let area=0
    for(let i=0;i<buffers.indices.length;i+=3){
      const [a,b,c]=[0,1,2].map(offset=>buffers.indices[i+offset]*3),v=buffers.positions
      const ux=v[b]-v[a],uy=v[b+1]-v[a+1],uz=v[b+2]-v[a+2],vx=v[c]-v[a],vy=v[c+1]-v[a+1],vz=v[c+2]-v[a+2]
      expect(Math.hypot(uy*vz-uz*vy,uz*vx-ux*vz,ux*vy-uy*vx)).toBeGreaterThan(1e-8)
      if(i<buffers.regions[0]+buffers.regions[1])area+=Math.abs(uz*vx-ux*vz)/2
    }
    const expected=Math.PI*vision.radiusX*vision.radiusZ*(coverage==='partial'?.5:coverage==='open'?1-.76**2:1)
    expect(Math.abs(area-expected)/expected).toBeLessThan(.002)
  }
})
test('resolution adapts within memory and quality bounds without oscillating near the frame target',()=>{
  expect(nextResolution(1,20,0,'balanced')).toBe(1)
  expect(nextResolution(1,30,0,'balanced')).toBe(.9)
  expect(nextResolution(1,15,400,'balanced')).toBe(.9)
  for(const tier of ['performance','balanced','high'] as const){expect(nextResolution(5,15,0,tier)).toBe(qualityProfiles[tier].maxDpr);expect(nextResolution(.1,50,1000,tier)).toBe(qualityProfiles[tier].minDpr)}
})
