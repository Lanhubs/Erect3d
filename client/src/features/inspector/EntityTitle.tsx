import {useProject} from '../../state/project'
import type {Selection} from '../../domain/types'
export function EntityTitle({selection}:{selection:NonNullable<Selection>}){
 const record=useProject(s=>s.project?.interpretation?.[selection.id])
 const label=(field:string)=>field.replace(/([a-z])([A-Z])/g,'$1 $2').toLowerCase()
 return <><div className="entity-title"><strong>{selection.kind.toUpperCase()}</strong><small>{selection.id}</small></div>
  {record&&<details><summary>Source and construction assumptions</summary>
   <small>{record.origin==='detected'?'Source-derived geometry':record.origin==='inferred'?'Inferred geometry':'User-selected geometry'}{record.evidence?` · ${record.evidence}`:''}</small>
   {!!record.inferredFields?.length&&<p>Construction defaults to review: {record.inferredFields.map(label).join(', ')}.</p>}
   {record.assumptions?.map((text,i)=><small key={i}>{text}</small>)}
  </details>}</>
}
