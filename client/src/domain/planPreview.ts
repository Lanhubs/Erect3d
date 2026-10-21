import type {Level,Point} from './types'
import {wallSubpath,wallBoundsPoints} from '../geometry/math'

export type PlanPreview={revision:number;levelName:string;svg:string|null}
type PreviewProject={buildings:{levels:Pick<Level,'elevation'|'name'|'walls'|'rooms'|'slabs'|'doors'|'windows'|'passages'>[]}[]}
const number=(value:number)=>Number.isFinite(value)?Number(value.toFixed(3)):0
const points=(polygon:Point[])=>polygon.map(point=>`${number(point.x)},${number(point.z)}`).join(' ')
// Only numeric geometry and fixed presentation strings enter the SVG. Source
// images, labels, links and user-provided markup are never embedded.
export function createPlanPreview(project:PreviewProject,revision=0):PlanPreview{
  const level=project.buildings[0]?.levels.toSorted((a,b)=>a.elevation-b.elevation)[0]
  if(!level)return {revision,levelName:'',svg:null}
  const all=[...wallBoundsPoints(level.walls),...level.rooms.flatMap(room=>room.polygon),...(level.slabs||[]).flatMap(slab=>slab.polygon)]
  if(!all.length)return {revision,levelName:level.name,svg:null}
  const bounds=all.reduce((box,point)=>({minX:Math.min(box.minX,point.x),minZ:Math.min(box.minZ,point.z),maxX:Math.max(box.maxX,point.x),maxZ:Math.max(box.maxZ,point.z)}),{minX:Infinity,minZ:Infinity,maxX:-Infinity,maxZ:-Infinity})
  const {minX,minZ}=bounds,width=Math.max(1,bounds.maxX-minX),depth=Math.max(1,bounds.maxZ-minZ),span=Math.max(width,depth),pad=span*.08
  const polygon=(ring:Point[],fill:string)=>`<polygon points="${points(ring)}" fill="${fill}" stroke="#bbc7be" stroke-width="${number(span*.002)}"/>`
  const line=(ring:Point[],stroke:string,size:number)=>`<polyline points="${points(ring)}" fill="none" stroke="${stroke}" stroke-width="${number(size)}" stroke-linecap="round" stroke-linejoin="round"/>`
  const content=[...(level.slabs||[]).map(slab=>polygon(slab.polygon,'#e8e8df')),
    ...level.rooms.map(room=>polygon(room.polygon,'#dce4da')),
    ...level.walls.map(wall=>line(wallSubpath(wall,0,undefined,span/150),'#40564b',Math.max(wall.thickness,span*.003))),
    ...[...level.doors,...level.windows,...(level.passages||[])].map(opening=>{
      const wall=level.walls.find(wall=>wall.id===opening.wallId)
      return wall?line(wallSubpath(wall,opening.offset,opening.offset+opening.width,span/150),'#f4f6f1',Math.max(wall.thickness+.02,span*.004)):''
    }),...(level.slabs||[]).flatMap(slab=>slab.openings.map(opening=>polygon(opening.polygon,'#f4f6f1')))].join('')
  return {revision,levelName:level.name,svg:`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="${[minX-pad,minZ-pad,width+pad*2,depth+pad*2].map(number).join(' ')}"><rect x="${number(minX-pad)}" y="${number(minZ-pad)}" width="${number(width+pad*2)}" height="${number(depth+pad*2)}" fill="#f4f6f1"/>${content}</svg>`}
}
