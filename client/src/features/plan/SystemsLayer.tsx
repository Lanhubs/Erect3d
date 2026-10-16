import type {Level,Selection} from '../../domain/types'
import {useProject} from '../../state/project'
import {systemPoints} from '../../domain/systemValidation'
import {facadePath} from '../../geometry/systemCompiler'
import {articulationPath} from '../../geometry/articulationPath'
export function SystemsLayer({level,selection,select}:{level:Level;selection:Selection;select:(s:Selection)=>void}){
  const project=useProject(s=>s.project),tool=useProject(s=>s.tool)
  const systems=project?.buildings.find(b=>b.levels.some(l=>l.id===level.id))?.systems?.systems||[]
  return <g aria-label="Architectural systems">{systems.filter(s=>s.levelId===level.id&&s.visible!==false).map(system=>{
    const detail=system.kind==='articulation'?articulationPath(system):null
    const points=system.kind==='spiral-stair'?Array.from({length:48},(_,i)=>({x:system.center.x+system.radius*Math.cos(i*Math.PI/24),z:system.center.z+system.radius*Math.sin(i*Math.PI/24)})):detail?detail.footprint||detail.path:system.kind==='curtain-wall'?facadePath(system):systemPoints(system)
    if(!points.length)return null
    const closed=system.kind==='spiral-stair'||'polygon' in system||!!detail?.footprint,d=points.map((p,i)=>`${i?'L':'M'}${p.x},${p.z}`).join(' ')+(closed?'Z':'')+(detail?.holes||[]).map(ring=>ring.map((p,i)=>`${i?'L':'M'}${p.x},${p.z}`).join(' ')+'Z').join(' ')
    const spiral=system.kind==='spiral-stair'?` ${Array.from({length:48},(_,i)=>{const a=i*Math.PI/24,r=system.radius-system.width;return `${i?'L':'M'}${system.center.x+r*Math.cos(a)},${system.center.z+r*Math.sin(a)}`}).join(' ')}Z`:''
    return <path key={system.id} d={d+spiral} fillRule="evenodd" fill={closed?system.kind==='void'?'#d6e9ed55':'#8499a122':'none'} stroke={selection?.id===system.id?'#bb854b':system.color}
      strokeWidth={selection?.id===system.id?.18:.1} strokeDasharray={system.kind==='void'?'.25 .15':undefined} pointerEvents={tool==='select'?'all':'none'}
      onClick={e=>{e.stopPropagation();select({kind:'architecture',id:system.id})}}><title>{system.name}</title></path>
  })}</g>
}
