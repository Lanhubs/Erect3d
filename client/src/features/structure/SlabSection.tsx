import type { Dispatch, SetStateAction } from 'react'
import { newSlab, wallEnvelope } from '../../domain/levels'
import type { Level, Selection } from '../../domain/types'
import { number, type LevelEdit, type VoidSize } from './structureRules'
import { SlabCard } from './SlabCard'

export function SlabSection({
  level,
  select,
  apply,
  voidSize,
  setVoidSize,
  setError,
}: {
  level: Level
  select: (selection: Selection) => void
  apply: LevelEdit
  voidSize: VoidSize
  setVoidSize: Dispatch<SetStateAction<VoidSize>>
  setError: (message: string) => void
}) {
  const addSlab = () => {
    const polygon = wallEnvelope(level)
    if (polygon.length)
      apply((draft) => {
        draft.slabs ||= []
        draft.slabs.push(newSlab(polygon, draft.slabThickness))
      })
  }
  return (
    <>
      <div className="structure-row">
        <strong>Floor slabs</strong>
        <button onClick={addSlab} disabled={!level.walls.length || level.locked}>
          Add from walls
        </button>
      </div>
      {level.slabs?.map((slab) => (
        <SlabCard
          key={slab.id}
          slab={slab}
          level={level}
          select={select}
          apply={apply}
          voidSize={voidSize}
          setError={setError}
        />
      ))}
      <div className="structure-row">
        <label>
          Opening width (m)
          <input
            type="number"
            min="0.2"
            value={voidSize.width}
            onChange={(event) =>
              setVoidSize((value) => ({ ...value, width: Math.max(0.2, number(event.target.value, 2)) }))
            }
          />
        </label>
        <label>
          Depth (m)
          <input
            type="number"
            min="0.2"
            value={voidSize.depth}
            onChange={(event) =>
              setVoidSize((value) => ({ ...value, depth: Math.max(0.2, number(event.target.value, 2)) }))
            }
          />
        </label>
      </div>
    </>
  )
}
