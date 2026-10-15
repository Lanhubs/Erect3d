import {makeLevel,makeProject,p,room} from './sampleHelpers'
export function basketballArenaSample(){
  const outline=Array.from({length:64},(_,i)=>p(40+38*Math.cos(i*Math.PI/32),35+32*Math.sin(i*Math.PI/32)))
  const ground=makeLevel('Court level',0,outline,[room('Basketball court',[p(26,27.5),p(54,27.5),p(54,42.5),p(26,42.5)],'timber','basketball-court')],[])
  ground.floorToFloorHeight=5.2
  const project=makeProject('Civic basketball arena','Arena',[ground])
  return project
}
