import type {Level,Selection} from '../../domain/types'
import {useProject} from '../../state/project'
import {systemPoints} from '../../domain/systemValidation'
import {facadePath} from '../../geometry/systemCompiler'
export function SystemsLayer({level,selection,select}:{level:Level;selection:Selection;select:(s:Selection)=>void}){
  const project=useProject(s=>s.project),tool=useProject(s=>s.tool)
  const systems=project?.buildings.find(b=>b.levels.some(l=>l.id===level.id))?.systems?.systems||[]
  return <g aria-label="Architectural systems">{systems.filter(s=>s.levelId===level.id&&s.visible!==false).map(system=>{
    const points=system.kind==='curtain-wall'?facadePath(system):systemPoints(system)
    if(!points.length)return null
    const closed='polygon' in system,d=points.map((p,i)=>`${i?'L':'M'}${p.x},${p.z}`).join(' ')+(closed?'Z':'')
    return <path key={system.id} d={d} fill={closed?system.kind==='void'?'#d6e9ed55':'#8499a122':'none'} stroke={selection?.id===system.id?'#bb854b':system.color}
      strokeWidth={selection?.id===system.id?.18:.1} strokeDasharray={system.kind==='void'?'.25 .15':undefined} pointerEvents={tool==='select'?'all':'none'}
      onClick={e=>{e.stopPropagation();select({kind:'architecture',id:system.id})}}><title>{system.name}</title></path>
  })}</g>
}
