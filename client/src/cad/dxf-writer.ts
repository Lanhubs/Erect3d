import { entityDxf, pair } from './dxf-entities'
import { entityPoints, type CadScene } from './types'

/** R2000 keeps the file ASCII and readable by every CAD tool; six is metres, one is ISO. */
const acadVersion = 'AC1015'
const insunits = 6
const measurement = 1
const firstHandle = 0x10000

const newHandles = () => {
  let next = firstHandle
  return () => (next++).toString(16).toUpperCase()
}

const section = (name: string, body: string) => pair(0, 'SECTION') + pair(2, name) + body + pair(0, 'ENDSEC')

const variable = (name: string, code: number, value: string | number) => pair(9, name) + pair(code, value)

const extents = (scene: CadScene) => {
  const heights = scene.entities.flatMap((entity) => entityPoints(entity).map((point) => point.z || 0))
  return {
    minZ: heights.length ? Math.min(0, ...heights) : 0,
    maxZ: heights.length ? Math.max(0, ...heights) : 0,
  }
}

function header(scene: CadScene, seed: string) {
  const { minZ, maxZ } = extents(scene)
  return (
    variable('$ACADVER', 1, acadVersion) +
    variable('$INSUNITS', 70, insunits) +
    variable('$MEASUREMENT', 70, measurement) +
    variable('$EXTMIN', 10, scene.bounds.minX) +
    pair(20, scene.bounds.minY) +
    pair(30, minZ) +
    variable('$EXTMAX', 10, scene.bounds.maxX) +
    pair(20, scene.bounds.maxY) +
    pair(30, maxZ) +
    variable('$HANDSEED', 5, seed)
  )
}

const ltypeTable = () =>
  pair(0, 'TABLE') +
  pair(2, 'LTYPE') +
  pair(70, 1) +
  pair(0, 'LTYPE') +
  pair(5, '1') +
  pair(100, 'AcDbSymbolTableRecord') +
  pair(100, 'AcDbLinetypeTableRecord') +
  pair(2, 'CONTINUOUS') +
  pair(70, 0) +
  pair(3, 'Solid line') +
  pair(72, 65) +
  pair(73, 0) +
  pair(40, 0) +
  pair(0, 'ENDTAB')

const layerTable = (scene: CadScene, handle: () => string) =>
  pair(0, 'TABLE') +
  pair(2, 'LAYER') +
  pair(70, scene.layers.length) +
  scene.layers
    .map(
      (layer) =>
        pair(0, 'LAYER') +
        pair(5, handle()) +
        pair(100, 'AcDbSymbolTableRecord') +
        pair(100, 'AcDbLayerTableRecord') +
        pair(2, layer.name) +
        pair(70, 0) +
        pair(62, layer.colour) +
        pair(6, 'CONTINUOUS') +
        pair(370, 0),
    )
    .join('') +
  pair(0, 'ENDTAB')

/** A minimal but strict ASCII DXF: header, the tables the sheet actually uses, then entities. */
export function writeDxf(scene: CadScene): string {
  const handle = newHandles()
  const entities = scene.entities.map((entity) => entityDxf(entity, handle())).join('')
  const tables = section('TABLES', ltypeTable() + layerTable(scene, handle))
  // $HANDSEED is written into the header, so it claims the first handle the sheet leaves free.
  return section('HEADER', header(scene, handle())) + tables + section('ENTITIES', entities) + pair(0, 'EOF')
}
