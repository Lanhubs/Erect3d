import { useState } from 'react'
import { uid, type ArchitecturalDetail, type Level, type Selection } from '../../domain/types'
import { useProject } from '../../state/project'

const kinds: ArchitecturalDetail['kind'][] = ['railing', 'screen', 'fin', 'canopy', 'parapet', 'pergola', 'arch']
export function ArchitecturalDetailsPanel({ level, select,embedded=false }: { level: Level; select: (selection: Selection) => void;embedded?:boolean }) {
  const [open, setOpen] = useState(embedded), [kind, setKind] = useState<ArchitecturalDetail['kind']>('railing')
  const editProject = useProject(state => state.editProject)
  const add = () => {
    const wall = level.walls.find(item => item.kind === 'exterior') || level.walls[0]
    const start = wall?.start || { x: 0, z: 0 }
    const end = wall ? { x: start.x + (wall.end.x - start.x) * Math.min(1, 5 / Math.max(.1,
      Math.hypot(wall.end.x - start.x, wall.end.z - start.z))),
      z: start.z + (wall.end.z - start.z) * Math.min(1, 5 / Math.max(.1,
        Math.hypot(wall.end.x - start.x, wall.end.z - start.z))) } : { x: 5, z: 0 }
    const detail: ArchitecturalDetail = { id: uid('detail'), name: `${kind[0].toUpperCase()}${kind.slice(1)}`,
      kind, start, end, baseElevation: 0, height: kind === 'canopy' || kind === 'pergola' ? 3 : kind === 'arch' ? 3 : 1.1,
      depth: kind === 'canopy' || kind === 'pergola' ? 1.8 : .2, spacing: kind === 'screen' ? .3 : 1.2,
      material: kind === 'pergola' || kind === 'screen' ? 'timber' : 'steel' }
    editProject(project => {
      const target = project.buildings[0].levels.find(item => item.id === level.id)
      if (target && !target.locked) { target.details ||= []; target.details.push(detail) }
      return project
    })
    select({ kind: 'detail', id: detail.id })
  }
  const remove = (id: string) => editProject(project => {
    const target = project.buildings[0].levels.find(item => item.id === level.id)
    if (target && !target.locked) target.details = target.details?.filter(item => item.id !== id)
    return project
  })
  return <section className="structure-panel" aria-label="Architectural details">
    <button className="structure-toggle" aria-expanded={open} onClick={() => setOpen(value => !value)}>
      Architectural details · {level.details?.length || 0}<span>{open ? '−' : '+'}</span>
    </button>
    {open && <div className="structure-body">
      <div className="structure-row"><select aria-label="Detail type" value={kind}
        onChange={event => setKind(event.target.value as ArchitecturalDetail['kind'])}>
        {kinds.map(item => <option key={item} value={item}>{item}</option>)}
      </select><button disabled={level.locked} onClick={add}>Add detail</button></div>
      {level.details?.map(detail => <div className="structure-row" key={detail.id}>
        <span>{detail.name} · {detail.kind}</span>
        <button onClick={() => select({ kind: 'detail', id: detail.id })}>Edit</button>
        <button disabled={level.locked} onClick={() => remove(detail.id)}>Remove</button>
      </div>)}
    </div>}
  </section>
}
