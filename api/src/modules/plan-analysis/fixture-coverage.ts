import type {Project} from '../../contracts/project'
import type {ModelQuality} from './quality'
import {containsPoint} from '../../../../client/src/geometry/polygons'
export function fixtureCoverage(project:Project,levelId:string):ModelQuality['issues']{
 const level=project.buildings.flatMap(b=>b.levels).find(l=>l.id===levelId)
 if(!level)return []
 return level.rooms.flatMap(room=>{
  const types=/living|sitting|lounge/i.test(room.name)?['sofa','armchair','coffee-table','television-unit']
   :/dining/i.test(room.name)?['dining-table','dining-chair']
   :/kitchen/i.test(room.name)?['kitchen-cabinet','kitchen-island','sink','cooker','refrigerator']
   :/bath|toilet|shower/i.test(room.name)?['bathtub','toilet','bathroom-sink','shower']:[]
  if(!types.length||(level.furniture||[]).some(f=>types.includes(f.type)&&containsPoint(room.polygon,f.position)))return []
  return [{code:'ROOM_FIXTURES_UNCHECKED',severity:'warning' as const,candidateId:project.interpretation?.[room.id]?.candidateId,
   message:`No depicted furniture or fixture was identified in ${room.name}. Inspect this source room for supported symbols, keeping their real size and orientation; leave it empty only if none is actually shown.`}]
 })
}
