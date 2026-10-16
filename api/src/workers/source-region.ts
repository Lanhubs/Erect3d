import type {Candidate} from '../contracts/analysis'
export type SourceRegion={x:number;y:number;width:number;height:number}
export function inSourceRegion(candidate:Candidate,region?:SourceRegion){
  return !region||candidate.points.every(p=>p.x>=region.x-1e-6&&p.y>=region.y-1e-6&&p.x<=region.x+region.width+1e-6&&p.y<=region.y+region.height+1e-6)
}
