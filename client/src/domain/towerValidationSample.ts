import {makeLevel,makeProject,p,room} from './sampleHelpers'
import {defaultRoof} from './types'
import {createSystem} from './createSystem'
export function towerValidationSample(count=32){
  const outline=[p(0,0),p(36,0),p(36,28),p(0,28)]
  const template=makeLevel('Typical office floor',0,outline,[room('Office floor',outline,'carpet')],[[p(12,0),p(12,8)],[p(24,20),p(24,28)]])
  template.floorToFloorHeight=3.6;template.walls=template.walls.slice(4);template.autoRoof=false
  const core=[p(15,10),p(21,10),p(21,18),p(15,18)]
  template.slabs![0].openings=[{id:'tower-core-void',kind:'shaft',polygon:core}]
  const project=makeProject(`${count}-storey office · validation fixture`,'Office tower',[template],{...defaultRoof,shape:'terrace',pitch:0})
  const building=project.buildings[0],repeat=createSystem('typical-floors',template)
  if(repeat.kind!=='typical-floors')throw new Error('Invalid floor fixture')
  repeat.count=count;repeat.name=`Office floors 1–${count}`
  const facade=createSystem('curtain-wall',template),circulation=createSystem('core',template)
  if(facade.kind!=='curtain-wall'||circulation.kind!=='core')throw new Error('Invalid architecture fixture')
  facade.path=[...outline,outline[0]];facade.height=count*3.6;facade.transomHeight=3.6;facade.bayWidth=1.5
  circulation.polygon=core;circulation.height=count*3.6
  building.systems={version:1,typology:'office-tower',systems:[repeat,facade,circulation]}
  building.roofSections=[{id:'tower-crown',name:'Flat tower crown',levelId:template.id,footprint:outline,voids:[core],topHeight:count*3.6,roof:{...defaultRoof,shape:'terrace',pitch:0,material:'membrane'}}]
  return project
}
