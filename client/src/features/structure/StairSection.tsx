import { newSlab, wallEnvelope } from '../../domain/levels'
import { updateStair } from '../../domain/structure'
import { uid, type Level, type Project, type Selection, type Stair } from '../../domain/types'
import { stairOpening } from '../../geometry/stairs'
import { containsPolygon } from '../../geometry/polygons'
import { findStairPlacement } from '../../geometry/stairPlacement'
import { useProject } from '../../state/project'
import { StairCard } from './StairCard'
import { StairGuidesPanel } from './StairGuidesPanel'

export function StairSection({
  project,
  level,
  upper,
  target,
  form,
  setForm,
  setTargetId,
  select,
  setError,
}: {
  project: Project
  level: Level
  upper: Level[]
  target?: Level
  form: Stair['form']
  setForm: (form: Stair['form']) => void
  setTargetId: (id: string) => void
  select: (selection: Selection) => void
  setError: (message: string) => void
}) {
  const editProject = useProject((state) => state.editProject)
  const addStair = () => {
    if (!target) return
    const openingId = uid('opening')
    const initial: Stair = {
      id: uid('stair'),
      fromLevelId: level.id,
      toLevelId: target.id,
      start: { x: 0, z: 0 },
      direction: 0,
      form,
      width: 1.1,
      riserHeight: 0.17,
      treadDepth: 0.28,
      landingLength: 1.2,
      openingId,
    }
    const targetSlabs = target.slabs?.length
      ? target.slabs
      : [newSlab(wallEnvelope(target), target.slabThickness)]
    const stair = findStairPlacement(initial, project.buildings[0].levels, targetSlabs)
    if (!stair) {
      setError('No clear stair route fits within the upper slab. Adjust the plan or slab, then try again.')
      return
    }
    const openingPolygon = stairOpening(stair, project.buildings[0].levels)
    setError('')
    editProject((copy) => {
      const levels = copy.buildings[0].levels,
        from = levels.find((item) => item.id === level.id),
        to = levels.find((item) => item.id === target.id)
      if (!from || !to || from.locked || to.locked) return copy
      from.stairs ||= []
      from.stairs.push(stair)
      to.slabs ||= []
      if (!to.slabs.length) {
        const polygon = wallEnvelope(to)
        if (polygon.length) to.slabs.push(newSlab(polygon, to.slabThickness))
      }
      const opening = { id: openingId, kind: 'stair' as const, polygon: openingPolygon }
      to.slabs.find((slab) => containsPolygon(slab.polygon, openingPolygon))?.openings.push(opening)
      return copy
    })
  }
  const changeStair = (id: string, change: Partial<Stair>) => {
    const probe = structuredClone(project)
    const issue = updateStair(probe, id, change)
    if (issue) {
      setError(issue)
      return
    }
    setError('')
    editProject((copy) => {
      updateStair(copy, id, change)
      return copy
    })
  }
  const repositionStair = (stair: Stair) => {
    const levels = project.buildings[0].levels
    const destination = levels.find((item) => item.id === stair.toLevelId)
    const placed = findStairPlacement(stair, levels, destination?.slabs || [], stair.start)
    if (!placed) {
      setError(
        'No clear stair route fits the destination floor. Check the slab, walls and existing openings.',
      )
      return
    }
    changeStair(stair.id, { start: placed.start, direction: placed.direction })
  }
  const removeStair = (stair: Stair) =>
    editProject((copy) => {
      const levels = copy.buildings[0].levels
      const from = levels.find((item) => item.id === level.id),
        to = levels.find((item) => item.id === stair.toLevelId)
      if (from) from.stairs = from.stairs?.filter((item) => item.id !== stair.id)
      to?.slabs?.forEach((slab) => {
        slab.openings = slab.openings.filter((item) => item.id !== stair.openingId)
      })
      return copy
    })
  return (
    <>
      <div className="structure-row">
        <strong>Stairs</strong>
        <button onClick={addStair} disabled={!target || level.locked || target.locked}>
          Connect to level
        </button>
      </div>
      {upper.length > 0 && (
        <div className="structure-row">
          <select
            aria-label="Destination level"
            value={target?.id || ''}
            onChange={(event) => setTargetId(event.target.value)}
          >
            {upper.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Stair form"
            value={form}
            onChange={(event) => setForm(event.target.value as Stair['form'])}
          >
            <option value="straight">Straight</option>
            <option value="L">L turn</option>
            <option value="U">U turn</option>
          </select>
        </div>
      )}
      <StairGuidesPanel project={project} level={level} target={target} form={form} />
      {level.stairs?.map((stair) => (
        <StairCard
          key={stair.id}
          stair={stair}
          project={project}
          level={level}
          select={select}
          changeStair={changeStair}
          repositionStair={repositionStair}
          removeStair={removeStair}
        />
      ))}
    </>
  )
}
