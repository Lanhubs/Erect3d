import { legalLayer, type CadEntity, type CadLayer } from './types'

/** AutoCAD colour index per semantic layer, ordered the way a drawing sheet reads. */
const palette: [string, number][] = [
  ['A-WALL', 7],
  ['A-DOOR', 30],
  ['A-WINDOW', 4],
  ['A-OPENING', 1],
  ['A-ROOM', 8],
  ['A-ROOM-NAME', 2],
  ['A-SLAB', 9],
  ['A-SLAB-OPEN', 6],
  ['A-COLUMN', 5],
  ['A-STAIR', 3],
  ['A-RAMP', 133],
  ['A-FURN', 252],
  ['A-SEAT', 40],
  ['A-ANNO', 2],
]

const colourOf = new Map(palette)

/** Multi-floor sheets suffix every layer so each storey stays selectable on its own. */
export const layerName = (base: string, suffix: string) => legalLayer(suffix ? `${base}-${suffix}` : base)

export function retag(entities: CadEntity[], suffix: string): CadEntity[] {
  if (!suffix) return entities
  return entities.map((entity) => ({ ...entity, layer: layerName(entity.layer, suffix) }))
}

/** Only the layers a sheet actually uses, so the LAYER table stays small and meaningful. */
export function layersUsed(entities: CadEntity[]): CadLayer[] {
  const used = new Set(entities.map((entity) => entity.layer))
  return [...used].map((name) => ({
    name,
    colour: colourOf.get(name.replace(/-L\d+$/, '')) || 7,
  }))
}
