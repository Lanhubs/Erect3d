import { useState } from 'react'
import type { Level, Project, Selection, Stair } from '../../domain/types'
import { useProject } from '../../state/project'
import { ColumnSection } from './ColumnSection'
import { SlabSection } from './SlabSection'
import { StairSection } from './StairSection'
import type { LevelEdit, VoidSize } from './structureRules'
import './structure.css'

export function StructurePanel({
  project,
  level,
  select,
  embedded = false,
}: {
  project: Project
  level: Level
  select: (selection: Selection) => void
  embedded?: boolean
}) {
  const editProject = useProject((state) => state.editProject)
  const [open, setOpen] = useState(embedded)
  const [targetId, setTargetId] = useState('')
  const [form, setForm] = useState<Stair['form']>('straight')
  const [voidSize, setVoidSize] = useState<VoidSize>({ width: 2, depth: 2 })
  const [error, setError] = useState('')
  const upper = project.buildings[0].levels
    .filter((item) => item.elevation > level.elevation)
    .sort((a, b) => a.elevation - b.elevation)
  const target = upper.find((item) => item.id === targetId) || upper[0]
  const apply: LevelEdit = (change) =>
    editProject((copy) => {
      const draft = copy.buildings[0].levels.find((item) => item.id === level.id)
      if (draft && !draft.locked) change(draft)
      return copy
    })
  return (
    <section className="structure-panel" aria-label="Structural elements">
      <button className="structure-toggle" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        Structure · {level.slabs?.length || 0} slabs · {level.columns?.length || 0} columns ·{' '}
        {level.stairs?.length || 0} stairs · {level.ramps?.length || 0} ramps ·{' '}
        {level.seatingSections?.length || 0} seating zones <span>{open ? '−' : '+'}</span>
      </button>
      {open && (
        <div className="structure-body">
          {error && (
            <div className="inline-error" role="alert">
              {error}
            </div>
          )}
          <SlabSection
            level={level}
            select={select}
            apply={apply}
            voidSize={voidSize}
            setVoidSize={setVoidSize}
            setError={setError}
          />
          <ColumnSection level={level} select={select} apply={apply} />
          <StairSection
            project={project}
            level={level}
            upper={upper}
            target={target}
            form={form}
            setForm={setForm}
            setTargetId={setTargetId}
            select={select}
            setError={setError}
          />
        </div>
      )}
    </section>
  )
}
