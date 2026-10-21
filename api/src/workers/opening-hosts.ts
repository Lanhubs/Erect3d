import type {Intelligence,Candidate} from '../contracts/analysis'
import {bridgeOpeningHosts} from './opening-bridges'
import {completeGarageOpenings} from './garage-openings'
type Point={x:number;y:number}
export function alignOpeningHosts(proposal:Intelligence,width:number,height:number) {
  const result=bridgeOpeningHosts(completeGarageOpenings(proposal,width,height),width,height),walls=result.candidates.filter(item=>item.kind==='wall' && !item.curve)
  const pixel=(p:Point)=>({x:p.x*width,y:p.y*height})
  for(const opening of result.candidates.filter(item=>['door','window','passage'].includes(item.kind) && item.points.length===2)) {
    const points=opening.points.map(pixel),ox=points[1].x-points[0].x,oy=points[1].y-points[0].y,span=Math.hypot(ox,oy)
    if(span<1)continue
    let best:{wall:Candidate;points:Point[];score:number}|undefined
    for(const wall of walls)for(let index=1;index<wall.points.length;index++) {
      const a=pixel(wall.points[index-1]),b=pixel(wall.points[index]),dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy)
      if(!length || Math.abs((ox*dx+oy*dy)/(span*length))<.98)continue
      const offsets=points.map(point=>((point.x-a.x)*dx+(point.y-a.y)*dy)/length)
      if(offsets.some(offset=>offset< -2 || offset>length+2))continue
      const distances=points.map(point=>Math.abs((point.x-a.x)*dy-(point.y-a.y)*dx)/length)
      const tolerance=Math.max(2,(wall.thickness || 0)*width/2)
      if(distances.some(distance=>distance>tolerance))continue
      const score=Math.max(...distances)+(wall.id===opening.wallId?0:.1)
      if(best && score>=best.score)continue
      best={wall,score,points:offsets.map(offset=>{
        const along=Math.max(0,Math.min(length,offset));return{x:(a.x+dx*along/length)/width,y:(a.y+dy*along/length)/height}
      })}
    }
    if(!best){
      // An open circulation route cannot punch a horizontal gap into an
      // unrelated diagonal wall. Keep its source guide and leave that route
      // open, rather than fabricating a host or blocking the whole building.
      if(opening.kind==='passage' && opening.wallId){delete opening.wallId;opening.uncertainties=[...opening.uncertainties,'Open circulation has no parallel enclosing wall; retained as a source guide'].slice(0,20)}
      continue
    }
    if(opening.wallId!==best.wall.id || opening.points.some((p,index)=>Math.hypot((p.x-best!.points[index].x)*width,(p.y-best!.points[index].y)*height)>.1)) {
      opening.uncertainties=[...opening.uncertainties,'Opening aligned to an existing measured/proposed host within native pixel tolerance'].slice(0,20)
    }
    opening.wallId=best.wall.id;opening.points=best.points
  }
  return result
}
