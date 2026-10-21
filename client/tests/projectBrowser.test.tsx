import {expect,test} from 'bun:test'
import {visibleProjects,type DashboardProject} from '../src/features/projects/Dashboard'
import {createPlanPreview} from '../src/domain/planPreview'
import {fixtureProject} from '../src/domain/fixture'
test('project search and sorting are deterministic and never mutate the server list',()=>{
  const items:DashboardProject[]=[{id:'b',name:'North House',modified:30,sources:[]},{id:'a',name:'Office',modified:10,sources:[]},{id:'c',name:'South House',modified:20,sources:[]}]
  expect(visibleProjects(items,' HOUSE ','recent').map(p=>p.id)).toEqual(['b','c'])
  expect(visibleProjects(items,'','oldest').map(p=>p.id)).toEqual(['a','c','b'])
  expect(visibleProjects(items,'','name').map(p=>p.id)).toEqual(['b','a','c'])
  expect(items.map(p=>p.id)).toEqual(['b','a','c'])
})
test('plan previews use the lowest floor and only fixed SVG markup and numeric geometry',()=>{
  const project=fixtureProject('<script>private label</script>'),floor=project.buildings[0].levels[0]
  project.sources=[{id:'private',name:'private-source.png',mime:'image/png',width:100,height:100}]
  floor.name='<svg onload="bad()">';floor.walls[0].color='url(https://private.example)'
  const before=JSON.stringify(project),preview=createPlanPreview(project,7)
  expect(preview.revision).toBe(7);expect(preview.levelName).toBe(floor.name)
  expect(preview.svg).toContain('<svg xmlns=');expect(preview.svg).not.toContain('private');expect(preview.svg).not.toContain('onload');expect(preview.svg).not.toContain('script')
  expect(JSON.stringify(project)).toBe(before)
  project.buildings[0].levels.push({...structuredClone(floor),id:'basement',name:'Basement',elevation:-3,walls:[],rooms:[],slabs:[]})
  expect(createPlanPreview(project)).toEqual({revision:0,levelName:'Basement',svg:null})
})
