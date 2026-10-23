import type { ArchitecturalDetail, Level, Selection } from '../../domain/types'
import { useProject } from '../../state/project'

const kinds: ArchitecturalDetail['kind'][] = [
  'railing',
  'screen',
  'fin',
  'canopy',
  'parapet',
  'pergola',
  'arch',
]
const materials: ArchitecturalDetail['material'][] = ['concrete', 'steel', 'timber', 'glass']

export function DetailInspector({
  level,
  selection,
  open,
  onClose,
}: {
  level: Level
  selection: Selection
  open?: boolean
  onClose?: () => void
}) {
  const editProject = useProject((state) => state.editProject),
    select = useProject((state) => state.setSelection)
  const detail = level.details?.find((item) => item.id === selection?.id)
  if (!detail) return null
  const update = (change: Partial<ArchitecturalDetail>) =>
    editProject((project) => {
      const target = project.buildings[0].levels.find((item) => item.id === level.id)
      if (target && !target.locked)
        target.details = target.details?.map((item) =>
          item.id === detail.id ? { ...item, ...change } : item,
        )
      return project
    })
  const dimension = (label: string, key: 'height' | 'depth' | 'baseElevation' | 'spacing', min = 0) => (
    <label className="inspector-field" key={key}>
      <span>{label} · m</span>
      <input
        type="number"
        min={min}
        step="0.05"
        value={detail[key]}
        onChange={(event) => update({ [key]: Math.max(min, Number(event.target.value)) })}
      />
    </label>
  )
  return (
    <aside className={`inspector${open ? ' mobile-open' : ''}`}>
      <div className="inspector-mobile-head">
        <strong>Detail properties</strong>
        <button type="button" onClick={onClose} aria-label="Close properties">
          ×
        </button>
      </div>
      <div className="panel-title">ARCHITECTURAL DETAIL</div>
      <div className="entity-title">
        <strong>{detail.kind.toUpperCase()}</strong>
        <small>{detail.id}</small>
      </div>
      <div className="fields">
        <label className="inspector-field">
          <span>Name</span>
          <input value={detail.name} onChange={(event) => update({ name: event.target.value })} />
        </label>
        <label className="inspector-field">
          <span>Element</span>
          <select
            value={detail.kind}
            onChange={(event) => update({ kind: event.target.value as ArchitecturalDetail['kind'] })}
          >
            {kinds.map((kind) => (
              <option key={kind} value={kind}>
                {kind}
              </option>
            ))}
          </select>
        </label>
        <label className="inspector-field">
          <span>Material</span>
          <select
            value={detail.material}
            onChange={(event) => update({ material: event.target.value as ArchitecturalDetail['material'] })}
          >
            {materials.map((material) => (
              <option key={material} value={material}>
                {material}
              </option>
            ))}
          </select>
        </label>
        <label className="inspector-field">
          <span>Colour</span>
          <input
            type="color"
            value={detail.color || '#788584'}
            onChange={(event) => update({ color: event.target.value })}
          />
        </label>
        {(['start', 'end'] as const).flatMap((pointName) =>
          (['x', 'z'] as const).map((axis) => (
            <label className="inspector-field" key={`${pointName}:${axis}`}>
              <span>
                {pointName} {axis.toUpperCase()} · m
              </span>
              <input
                type="number"
                step="0.05"
                value={detail[pointName][axis]}
                onChange={(event) =>
                  update({ [pointName]: { ...detail[pointName], [axis]: Number(event.target.value) } })
                }
              />
            </label>
          )),
        )}
        {dimension('Height', 'height', 0.1)}
        {dimension('Base elevation', 'baseElevation')}
        {dimension('Projection / depth', 'depth', 0.05)}
        {dimension('Repeat spacing', 'spacing', 0.15)}
      </div>
      <button
        className="delete-button"
        disabled={level.locked}
        onClick={() => {
          editProject((project) => {
            const target = project.buildings[0].levels.find((item) => item.id === level.id)
            if (target && !target.locked)
              target.details = target.details?.filter((item) => item.id !== detail.id)
            return project
          })
          select(null)
        }}
      >
        Delete detail
      </button>
    </aside>
  )
}
