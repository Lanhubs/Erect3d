import { wallEnvelope } from '../../domain/levels'
import { uid, type Column, type Level, type Selection } from '../../domain/types'
import { axes, number, squareColumn, type LevelEdit } from './structureRules'

export function ColumnSection({
  level,
  select,
  apply,
}: {
  level: Level
  select: (selection: Selection) => void
  apply: LevelEdit
}) {
  const update = (id: string, change: (column: Column) => void) =>
    apply((draft) => {
      const column = draft.columns?.find((item) => item.id === id)
      if (column) change(column)
    })
  return (
    <>
      <div className="structure-row">
        <strong>Columns</strong>
        <button
          disabled={level.locked}
          onClick={() =>
            apply((draft) => {
              const outline = wallEnvelope(draft)
              draft.columns ||= []
              draft.columns.push({
                id: uid('column'),
                position: outline[0] || { x: 0, z: 0 },
                shape: 'rectangular',
                ...squareColumn(0.3),
                height: draft.floorToFloorHeight || 3,
                material: 'concrete',
              })
            })
          }
        >
          Add column
        </button>
      </div>
      {level.columns?.map((column) => (
        <div className="structure-card" key={column.id}>
          <div className="structure-row">
            <b>Column</b>
            <button onClick={() => select({ kind: 'column', id: column.id })}>Inspect</button>
            <button
              onClick={() =>
                apply((draft) => {
                  draft.columns = draft.columns?.filter((item) => item.id !== column.id)
                })
              }
            >
              Remove
            </button>
          </div>
          <label>
            Shape
            <select
              value={column.shape}
              onChange={(event) =>
                update(column.id, (item) => {
                  item.shape = event.target.value as Column['shape']
                })
              }
            >
              <option value="rectangular">Rectangular</option>
              <option value="circular">Circular</option>
            </select>
          </label>
          {axes.map((axis) => (
            <label key={axis}>
              {axis.toUpperCase()} (m)
              <input
                type="number"
                step="0.1"
                defaultValue={column.position[axis]}
                onBlur={(event) =>
                  update(column.id, (item) => {
                    item.position[axis] = number(event.target.value, 0)
                  })
                }
              />
            </label>
          ))}
          <label>
            Size (m)
            <input
              type="number"
              min="0.1"
              step="0.05"
              defaultValue={column.shape === 'circular' ? column.diameter : column.width}
              onBlur={(event) =>
                update(column.id, (item) =>
                  Object.assign(item, squareColumn(number(event.target.value, 0.3))),
                )
              }
            />
          </label>
        </div>
      ))}
    </>
  )
}
