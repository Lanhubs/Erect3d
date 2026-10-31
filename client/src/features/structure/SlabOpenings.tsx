import { uid, type Point, type Slab, type SlabOpening } from '../../domain/types'
import { containsPolygon } from '../../geometry/polygons'
import { axes, centeredVoid, number, polygonCenter, shiftedPolygon, type VoidSize } from './structureRules'

export function SlabOpenings({
  slab,
  locked,
  voidSize,
  update,
  setError,
}: {
  slab: Slab
  locked?: boolean
  voidSize: VoidSize
  update: (change: Partial<Slab>) => void
  setError: (message: string) => void
}) {
  const moveOpening = (openingId: string, axis: 'x' | 'z', value: number) => {
    const opening = slab.openings.find((item) => item.id === openingId)
    if (!opening || opening.kind === 'stair') return
    const polygon = shiftedPolygon(opening.polygon, axis, value)
    if (!containsPolygon(slab.polygon, polygon)) {
      setError('The opening must stay within the slab.')
      return
    }
    setError('')
    update({ openings: slab.openings.map((item) => (item.id === openingId ? { ...item, polygon } : item)) })
  }
  const addVoid = () => {
    const polygon: Point[] = centeredVoid(slab.polygon, voidSize.width, voidSize.depth)
    if (!containsPolygon(slab.polygon, polygon)) {
      setError('This opening does not fit inside the slab.')
      return
    }
    setError('')
    update({ openings: [...slab.openings, { id: uid('opening'), kind: 'void', polygon }] })
  }
  const removeOpening = (opening: SlabOpening) =>
    update({ openings: slab.openings.filter((item) => item.id !== opening.id) })
  return (
    <>
      <div className="structure-row">
        <span>{slab.openings.length} openings</span>
        <button onClick={addVoid} disabled={locked}>
          Add opening
        </button>
      </div>
      {slab.openings.map((opening) => (
        <div className="structure-opening" key={opening.id}>
          <div className="structure-row">
            <span>{opening.kind === 'void' ? 'Open below' : opening.kind}</span>
            {opening.kind === 'stair' ? (
              <small>Managed by stair</small>
            ) : (
              <button onClick={() => removeOpening(opening)}>Remove</button>
            )}
          </div>
          {opening.kind !== 'stair' &&
            axes.map((axis) => (
              <label key={axis}>
                Centre {axis.toUpperCase()} · m
                <input
                  type="number"
                  step="0.1"
                  key={`${opening.id}:${axis}:${opening.polygon[0][axis]}`}
                  defaultValue={polygonCenter(opening.polygon, axis)}
                  onBlur={(event) => moveOpening(opening.id, axis, number(event.target.value, 0))}
                />
              </label>
            ))}
        </div>
      ))}
    </>
  )
}
