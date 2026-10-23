import { SystemGeometryFields } from './SystemGeometryFields'
import { ArticulationFields } from './ArticulationFields'
import { originLabels } from '../../domain/articulation'
import { useState } from 'react'
import type { Building, Level, Selection } from '../../domain/types'
import type { BuildingSystem } from '../../domain/buildingSystems'
import { systemCapabilities } from '../../domain/systemCapabilities'
import { createSystem } from '../../domain/createSystem'
import { validateSystems } from '../../domain/systemValidation'
import { detachTypicalFloor } from '../../domain/typicalFloors'
import { useProject } from '../../state/project'
export function SystemsInspector({
  building,
  level,
  selection,
}: {
  building: Building
  level: Level
  selection: Selection
}) {
  const [kind, setKind] = useState<BuildingSystem['kind']>('core'),
    [error, setError] = useState(''),
    [floor, setFloor] = useState(1)
  const edit = useProject((s) => s.editProject),
    select = useProject((s) => s.setSelection),
    active = useProject((s) => s.setActiveLevel)
  const systems = building.systems?.systems || [],
    selected = systems.find((s) => s.id === selection?.id)
  const update = (change: (list: BuildingSystem[]) => BuildingSystem[]) =>
    edit((project) => {
      const next = structuredClone(project),
        owner = next.buildings.find((b) => b.id === building.id)!
      if (level.locked || building.levels.find((l) => l.id === selected?.levelId)?.locked) {
        setError('Unlock the level before editing architectural systems.')
        return project
      }
      owner.systems = {
        version: 1,
        typology: owner.systems?.typology || 'unknown',
        systems: change(owner.systems?.systems || []),
      }
      const issues = validateSystems(owner)
      setError(issues.join(' · '))
      return issues.length ? project : next
    })
  const patch = (changes: Record<string, unknown>) =>
    update((list) =>
      list.map((s) =>
        s.id === selected?.id ? ({ ...s, ...changes, origin: 'user-selected' } as BuildingSystem) : s,
      ),
    )
  return (
    <details open={selection?.kind === 'architecture'} className="architecture-systems">
      <summary>Architectural systems · {systems.length}</summary>
      <label className="inspector-field">
        <span>System</span>
        <select
          value={selected?.id || ''}
          onChange={(e) => select(e.target.value ? { kind: 'architecture', id: e.target.value } : null)}
        >
          <option value="">Choose a system</option>
          {systems.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
      {selected && (
        <>
          <label className="inspector-field">
            <span>Name</span>
            <input value={selected.name} onChange={(e) => patch({ name: e.target.value })} />
          </label>
          <label className="inspector-field">
            <span>Level</span>
            <select value={selected.levelId} onChange={(e) => patch({ levelId: e.target.value })}>
              {building.levels.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
          <small>
            {originLabels[selected.origin]} · {selected.evidence}
          </small>
          {selected.assumptions?.map((assumption) => (
            <small key={assumption}>{assumption}</small>
          ))}
          <label className="inspector-field">
            <span>{selected.origin === 'design-proposal' ? 'Include proposed design' : 'Visible'}</span>
            <input
              type="checkbox"
              checked={selected.visible !== false}
              onChange={(e) => patch({ visible: e.target.checked })}
            />
          </label>
          {selected.kind === 'articulation' && <ArticulationFields system={selected} patch={patch} />}
          <label className="inspector-field">
            <span>Elevation · m</span>
            <input
              type="number"
              step=".1"
              value={selected.elevation}
              onChange={(e) => {
                const value = Number(e.target.value)
                if (Number.isFinite(value)) patch({ elevation: value })
              }}
            />
          </label>
          {systemCapabilities[selected.kind].fields.map((field) => (
            <label className="inspector-field" key={field.key}>
              <span>
                {field.label}
                {field.integer ? '' : ' · m'}
              </span>
              <input
                type="number"
                min={field.min}
                max={field.max}
                step={field.integer ? 1 : 0.05}
                value={Number((selected as unknown as Record<string, unknown>)[field.key])}
                onChange={(e) => {
                  let value = Number(e.target.value)
                  if (!Number.isFinite(value)) return
                  value = Math.max(field.min, Math.min(field.max, field.integer ? Math.round(value) : value))
                  patch({ [field.key]: value })
                }}
              />
            </label>
          ))}
          <label className="inspector-field">
            <span>Material color</span>
            <input type="color" value={selected.color} onChange={(e) => patch({ color: e.target.value })} />
          </label>
          {'role' in selected && (
            <label className="inspector-field">
              <span>Architectural role</span>
              <select value={selected.role} onChange={(e) => patch({ role: e.target.value })}>
                {(selected.kind === 'void'
                  ? ['atrium', 'courtyard', 'shaft']
                  : ['podium', 'tower', 'wing', 'crown', 'mechanical']
                ).map((role) => (
                  <option key={role}>{role}</option>
                ))}
              </select>
            </label>
          )}
          <SystemGeometryFields system={selected} patch={patch} levels={building.levels} />
          {selected.kind === 'typical-floors' && (
            <>
              <label className="inspector-field">
                <span>Template level</span>
                <select
                  value={selected.templateLevelId}
                  onChange={(e) => patch({ templateLevelId: e.target.value })}
                >
                  {building.levels.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </label>
              <p>Edits to the template update every linked floor. Detach a floor to edit it independently.</p>
              <label className="inspector-field">
                <span>Floor to detach</span>
                <input
                  type="number"
                  min={1}
                  max={selected.count}
                  value={selection?.floorIndex !== undefined ? selection.floorIndex + 1 : floor}
                  onChange={(e) => {
                    setFloor(Math.max(1, Math.min(selected.count, Math.round(Number(e.target.value)))))
                    select({ kind: 'architecture', id: selected.id })
                  }}
                />
              </label>
              <button
                onClick={() => {
                  try {
                    let levelId = ''
                    edit((project) => {
                      const next = detachTypicalFloor(
                        project,
                        building.id,
                        selected.id,
                        (selection?.floorIndex !== undefined ? selection.floorIndex + 1 : floor) - 1,
                      )
                      levelId = next.buildings
                        .find((b) => b.id === building.id)!
                        .systems!.systems.filter((s) => s.kind === 'typical-floors')
                        .find((s) => s.id === selected.id)!.detached[
                        String((selection?.floorIndex !== undefined ? selection.floorIndex + 1 : floor) - 1)
                      ]
                      return next
                    })
                    if (levelId) active(levelId)
                    select(null)
                    setError('')
                  } catch (e) {
                    setError(e instanceof Error ? e.message : String(e))
                  }
                }}
              >
                Detach and edit floor
              </button>
            </>
          )}
          <button
            onClick={() => {
              update((list) => list.filter((s) => s.id !== selected.id))
              select(null)
            }}
          >
            Remove system
          </button>
        </>
      )}
      <label className="inspector-field">
        <span>Add architecture</span>
        <select value={kind} onChange={(e) => setKind(e.target.value as BuildingSystem['kind'])}>
          {Object.entries(systemCapabilities).map(([key, c]) => (
            <option key={key} value={key}>
              {c.label}
            </option>
          ))}
        </select>
      </label>
      <button
        onClick={() => {
          const system = createSystem(kind, level)
          update((list) => [...list, system])
          select({ kind: 'architecture', id: system.id })
        }}
      >
        Add system
      </button>
      {error && <p role="alert">{error}</p>}
      {!error &&
        validateSystems(building).map((issue) => (
          <p role="alert" key={issue}>
            {issue}
          </p>
        ))}
    </details>
  )
}
