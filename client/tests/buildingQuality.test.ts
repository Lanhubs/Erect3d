import {expect,test} from 'bun:test'
import {buildingValidationSamples} from '../src/domain/buildingValidationSamples'
import {compileBuildingSystems} from '../src/geometry/systemCompiler'
import {windowAssembly} from '../src/geometry/windowAssembly'
import {windowConstructionIssue} from '../src/domain/windowConstruction'
import {wallSolids} from '../src/geometry/walls'
import {effectiveRoofSections} from '../src/domain/roofCoverage'
import {createOpeningIndex} from '../src/geometry/hostedOpenings'
import {shareUnchanged} from '../src/state/shareUnchanged'
import {RenderResources} from '../src/rendering/RenderResources'
import {roofSurfaceGeometry,roofSoffitGeometry} from '../src/geometry/roofSurfaceGeometry'
import {roofElevation} from '../src/geometry/roofElevation'
import {roofLayout} from '../src/geometry/roof'
const samples=buildingValidationSamples()
test('eleven building types retain their authored geometry through the architectural compiler and opening emitters',()=>{
 expect(samples.filter(s=>s.id.startsWith('qa-'))).toHaveLength(11)
 for(const sample of samples){
  const before=JSON.stringify(sample.project),building=sample.project.buildings[0],compiled=compileBuildingSystems(building)
  expect(compiled.errors).toEqual([])
  for(const pkg of compiled.packages){
   for(const part of [...pkg.parts,...pkg.glass,...pkg.frame,...Object.values(pkg.articulation||{}).flat()]){
    expect([...part.center,...part.size,part.rotation].every(Number.isFinite)).toBe(true)
    expect(part.size.every(n=>n>0)).toBe(true)
   }
  }
  for(const level of building.levels){
   for(const wall of level.walls){
    const solids=wallSolids(wall,level.doors,level.windows,level.passages||[])
    expect(solids.every(s=>Object.values(s).every(Number.isFinite))).toBe(true)
    for(const opening of level.windows.filter(w=>w.wallId===wall.id)){
     expect(windowConstructionIssue(opening,wall)).toBeNull()
     const parts=windowAssembly(wall,opening)
     expect(parts.glass.length).toBeGreaterThan(0)
     expect(Object.values(parts).flat().every(p=>[...p.center,...p.size,p.rotation].every(Number.isFinite))).toBe(true)
    }
   }
  }
  expect(effectiveRoofSections(building).every(s=>s.footprint.length>=3)).toBe(true)
  expect(JSON.stringify(sample.project)).toBe(before)
 }
})
test('editing one opening preserves other host inputs, structural geometry and roof inputs',()=>{
 const previous=samples.find(s=>s.id==='quality-house')!.project,index=createOpeningIndex(),before=index(previous.buildings[0].levels[0])
 const draft=structuredClone(previous);draft.buildings[0].levels[0].windows[0].width-=.2
 const next=shareUnchanged(previous,draft),after=index(next.buildings[0].levels[0]),changed=next.buildings[0].levels[0].windows[0].wallId
 expect(after.get(changed)).not.toBe(before.get(changed))
 for(const [id,host] of before)if(id!==changed)expect(after.get(id)).toBe(host)
 expect(next.buildings[0].levels[0].walls).toBe(previous.buildings[0].levels[0].walls)
 expect(next.buildings[0].roof).toBe(previous.buildings[0].roof)
 expect(next.buildings[0].systems).toBe(previous.buildings[0].systems)
})
test('construction batches share owned primitive resources and release a material only after its final user leaves',async()=>{
 const resources=new RenderResources(),geometry=resources.geometry('box'),material=resources.material('metal','#657279')
 expect(resources.geometry('box')).toBe(geometry);expect(resources.material('metal','#657279')).toBe(material)
 let disposed=0;material.addEventListener('dispose',()=>disposed++)
 resources.retain(material);resources.retain(material);resources.release(material);await Promise.resolve();expect(disposed).toBe(0)
 resources.release(material);await Promise.resolve();expect(disposed).toBe(1)
 expect(resources.materials.size).toBe(0);resources.dispose()
})
test('roofing faces point upward, soffits face downward, and sun fitting includes the actual ridge',()=>{
 const building=samples.find(s=>s.id==='quality-house')!.project.buildings[0],roof=building.roof!
 const faces=roofLayout({minX:0,maxX:14,minZ:0,maxZ:10,top:3.1},roof).faces
 const top=roofSurfaceGeometry(faces),bottom=roofSoffitGeometry(top)
 expect(top.index).not.toBeNull()
 for(let i=0;i<top.getAttribute('normal').count;i++)expect(top.getAttribute('normal').getY(i)).toBeGreaterThan(0)
 for(let i=0;i<bottom.getAttribute('normal').count;i++)expect(bottom.getAttribute('normal').getY(i)).toBeLessThan(0)
 const height=roofElevation(effectiveRoofSections(building),building.levels)
 expect(height).toBeGreaterThan(5);expect(height).toBeGreaterThan(Math.max(...building.levels[0].walls.map(w=>w.height)))
 top.dispose();bottom.dispose()
})
