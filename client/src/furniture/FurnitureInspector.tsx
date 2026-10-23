import { useState } from 'react'
import { uid, type Level, type Selection } from '../domain/types'
import { useProject } from '../state/project'
import { furnitureDimensions, furnitureIssues, variants } from './entities'
import { furnitureLabel, furnitureTypes, type FurnitureObject, type FurnitureType } from './types'
export function FurnitureInspector({
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
  const edit = useProject((state) => state.editProject),
    select = useProject((state) => state.setSelection)
  const [message, setMessage] = useState(''),
    object = level.furniture?.find((item) => item.id === selection?.id)
  const project = useProject((state) => state.project)
  if (!object) return null
  const update = (change: Partial<FurnitureObject>) => {
    const next = { ...object, ...change }
    if (
      ![next.width, next.depth, next.height, next.rotation, next.position.x, next.position.z].every(
        Number.isFinite,
      ) ||
      Math.min(next.width, next.depth, next.height) < 0.08
    ) {
      setMessage('Enter valid dimensions of at least 0.08 m.')
      return
    }
    next.roomId = furnitureIssues(next, level, project?.buildings[0].levels).roomId
    setMessage('')
    edit((copy) => {
      const owner = copy.buildings[0].levels.find((item) => item.id === level.id)!
      if (!owner.locked)
        owner.furniture = owner.furniture?.map((item) => (item.id === object.id ? next : item))
      return copy
    })
  }
  return (
    <aside className={`inspector furniture-inspector${open ? ' mobile-open' : ''}`}>
      <div className="inspector-mobile-head">
        <strong>Furniture properties</strong>
        <button onClick={onClose}>×</button>
      </div>
      <div className="panel-title">FURNITURE · {furnitureLabel(object.type)}</div>
      <fieldset className="fields" disabled={level.locked}>
        <label className="inspector-field">
          <span>Type</span>
          <select
            value={object.type}
            onChange={(event) => {
              const type = event.target.value as FurnitureType,
                [width, depth, height] = furnitureDimensions(type)
              update({ type, width, depth, height, assetId: variants(type)[0] })
            }}
          >
            {furnitureTypes.map((type) => (
              <option key={type} value={type}>
                {furnitureLabel(type)}
              </option>
            ))}
          </select>
        </label>
        <label className="inspector-field">
          <span>Variant</span>
          <select
            value={variants(object.type).includes(object.assetId) ? object.assetId : variants(object.type)[0]}
            onChange={(event) => {
              const [width, depth, height] = furnitureDimensions(object.type, event.target.value)
              update({ assetId: event.target.value, width, depth, height })
            }}
          >
            {variants(object.type).map((variant) => (
              <option key={variant}>{variant}</option>
            ))}
          </select>
        </label>
        {(['width', 'depth', 'height', 'rotation'] as const).map((field) => (
          <label className="inspector-field" key={field}>
            <span>
              {field} · {field === 'rotation' ? '°' : 'm'}
            </span>
            <input
              type="number"
              step={field === 'rotation' ? '5' : '.05'}
              value={Number(object[field].toFixed(3))}
              onChange={(event) => update({ [field]: Number(event.target.value) })}
            />
          </label>
        ))}
        {(['x', 'z'] as const).map((axis) => (
          <label className="inspector-field" key={axis}>
            <span>Position {axis.toUpperCase()} · m</span>
            <input
              type="number"
              step=".05"
              value={Number(object.position[axis].toFixed(3))}
              onChange={(event) =>
                update({ position: { ...object.position, [axis]: Number(event.target.value) } })
              }
            />
          </label>
        ))}
        <label className="inspector-field">
          <span>Color</span>
          <input
            type="color"
            value={object.materialOverrides?.color || '#b9aa91'}
            onChange={(event) =>
              update({ materialOverrides: { ...object.materialOverrides, color: event.target.value } })
            }
          />
        </label>
        <label className="inspector-field">
          <span>Finish</span>
          <select
            value={object.materialOverrides?.finish || 'timber'}
            onChange={(event) =>
              update({
                materialOverrides: { ...object.materialOverrides, finish: event.target.value as 'timber' },
              })
            }
          >
            {['timber', 'fabric', 'metal', 'ceramic'].map((finish) => (
              <option key={finish}>{finish}</option>
            ))}
          </select>
        </label>
        <button
          onClick={() => {
            const clone = {
              ...structuredClone(object),
              id: uid('furniture'),
              sourceDetectionId: undefined,
              position: { x: object.position.x + 0.35, z: object.position.z + 0.35 },
            }
            clone.roomId = furnitureIssues(clone, level, project?.buildings[0].levels).roomId
            edit((copy) => {
              const owner = copy.buildings[0].levels.find((item) => item.id === level.id)!
              owner.furniture!.push(clone)
              return copy
            })
            select({ kind: 'furniture', id: clone.id })
          }}
        >
          Duplicate
        </button>
        <button
          className="delete-button"
          onClick={() => {
            edit((copy) => {
              const owner = copy.buildings[0].levels.find((item) => item.id === level.id)!
              owner.furniture = owner.furniture?.filter((item) => item.id !== object.id)
              return copy
            })
            select(null)
          }}
        >
          Delete furniture
        </button>
      </fieldset>
      {(message || furnitureIssues(object, level, project?.buildings[0].levels).issues.join(' · ')) && (
        <div className="inline-error">
          {message || furnitureIssues(object, level, project?.buildings[0].levels).issues.join(' · ')}
        </div>
      )}
      <small>
        Drag handles in either view. Arrows move; [ / ] rotate; , / . resize. Placement warnings leave your
        chosen position unchanged.
      </small>
    </aside>
  )
}
