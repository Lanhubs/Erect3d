import type {Building,Project} from '../../contracts/project'
import type {EditCommand} from '../../contracts/assistant'
import {connectStairGuide} from '../../../../client/src/domain/stairGuides'
import {findStairPlacement} from '../../../../client/src/geometry/stairPlacement'
import {stairOpening} from '../../../../client/src/geometry/stairs'
import {containsPolygon} from '../../../../client/src/geometry/polygons'
import {newId} from '../../security/tokens'
import {ApiError} from '../../security/errors'
export function connectStair(project:Project,building:Building,command:Extract<EditCommand,{action:'connect-stair'}>){
  const from=building.levels.find(l=>l.id===command.levelId),to=building.levels.find(l=>l.id===command.toLevelId)
  if(!from||!to||from.locked||to.locked||to.elevation<=from.elevation)throw new ApiError(422,'ASSISTANT_STAIR','Choose unlocked connected floors with an upper slab')
  if(command.guideId){const issue=connectStairGuide(project,from.id,command.guideId,to.id,command.form,false);if(issue)throw new ApiError(422,'ASSISTANT_STAIR',issue);return}
  const initial={id:newId('stair'),fromLevelId:from.id,toLevelId:to.id,start:command.start||{x:0,z:0},direction:0,form:command.form,
    width:command.width||1.1,riserHeight:.17,treadDepth:.28,landingLength:1.2,openingId:newId('opening')}
  const stair=findStairPlacement(initial,building.levels,to.slabs||[],command.start)
  if(!stair)throw new ApiError(422,'ASSISTANT_STAIR','A complete stair does not fit these floors; choose a clear stairwell')
  const polygon=stairOpening(stair,building.levels),slab=to.slabs?.find(s=>containsPolygon(s.polygon,polygon))
  if(!slab)throw new ApiError(422,'ASSISTANT_STAIR','The upper floor needs a slab around the stairwell')
  ;(from.stairs||=[]).push(stair);slab.openings.push({id:stair.openingId!,kind:'stair',polygon})
}
