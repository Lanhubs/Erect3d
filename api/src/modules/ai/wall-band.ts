import type{Candidate}from'../../contracts/analysis'
import type{ImageScale}from'./candidateChecks'
export function sameWallBand(a:Candidate,b:Candidate,scale?:ImageScale) {
  if(!scale || !a.thickness || !b.thickness || a.points.length!==2 || b.points.length!==2)return false
  const pixel=(p:{x:number;y:number})=>({x:p.x*scale.width,y:p.y*scale.height})
  const [start,end]=a.points.map(pixel),[first,last]=b.points.map(pixel)
  const dx=end.x-start.x,dy=end.y-start.y,length=Math.hypot(dx,dy),ox=last.x-first.x,oy=last.y-first.y,span=Math.hypot(ox,oy)
  if(!length || !span || Math.abs((dx*ox+dy*oy)/(length*span))<.999)return false
  const across=(p:{x:number;y:number})=>Math.abs((p.x-start.x)*dy-(p.y-start.y)*dx)/length
  const thickness=Math.max(a.thickness,b.thickness)*scale.width
  if(Math.max(across(first),across(last))>thickness/2)return false
  const along=(p:{x:number;y:number})=>((p.x-start.x)*dx+(p.y-start.y)*dy)/length
  const low=Math.min(along(first),along(last)),high=Math.max(along(first),along(last))
  return Math.min(length,high)-Math.max(0,low)>=Math.min(length,span)*.95
}
