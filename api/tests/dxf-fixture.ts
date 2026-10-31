import { dxfDocument, entity, groups, section, table, type Group } from './dxf-builder'

// A millimetre-scale ASCII DXF of a 6 m by 4 m floor: outline, curved door swing, arced wall,
// column, room labels, a furniture block insert and one switched-off layer.
const loop = (layer: string, points: [number, number][], closed = true): Group[] => [
  [8, layer],
  [90, points.length],
  [70, closed ? 1 : 0],
  ...points.flatMap(
    ([x, y]) =>
      [
        [10, x],
        [20, y],
      ] as Group[],
  ),
]

const layer = (name: string, frozen: boolean, colour: number) =>
  entity('LAYER', [
    [2, name],
    [70, frozen ? 1 : 0],
    [62, colour],
  ])

const header = groups([
  [9, '$ACADVER'],
  [1, 'AC1015'],
  [9, '$INSUNITS'],
  [70, 4],
])

const blocks = section('BLOCKS', [
  '0',
  'BLOCK',
  ...groups([
    [2, 'DESK'],
    [8, 'FURN'],
    [10, 0],
    [20, 0],
  ]),
  ...entity(
    'LWPOLYLINE',
    loop('FURN', [
      [0, 0],
      [1200, 0],
      [1200, 750],
      [0, 750],
    ]),
  ),
  '0',
  'ENDBLK',
])

const entities = section('ENTITIES', [
  ...entity(
    'LWPOLYLINE',
    loop('WALLS', [
      [0, 0],
      [6000, 0],
      [6000, 4000],
      [1500, 4000],
      [0, 4000],
    ]),
  ),
  ...entity('LWPOLYLINE', [
    [8, 'WALLS'],
    [90, 2],
    [70, 0],
    [10, 2400],
    [20, 0],
    [42, -0.41421356],
    [10, 3500],
    [20, 0],
  ]),
  ...entity('ARC', [
    [8, 'WALLS'],
    [10, 3000],
    [20, 2000],
    [40, 500],
    [50, 0],
    [51, 180],
  ]),
  ...entity('CIRCLE', [
    [8, 'WALLS'],
    [10, 1000],
    [20, 1000],
    [40, 120],
  ]),
  ...entity('TEXT', [
    [1, 'LIVING'],
    [8, 'TEXT'],
    [10, 2000],
    [20, 2000],
    [40, 220],
  ]),
  ...entity('MTEXT', [
    [1, 'KITCHEN'],
    [8, 'TEXT'],
    [10, 4500],
    [20, 3500],
    [40, 220],
  ]),
  ...entity('INSERT', [
    [2, 'DESK'],
    [8, 'FURN'],
    [10, 4000],
    [20, 500],
    [41, 1],
    [42, 1],
    [50, 0],
  ]),
  ...entity('LINE', [
    [8, 'OFF'],
    [10, 0],
    [20, 0],
    [11, 6000],
    [21, 4000],
  ]),
])

export const dxfPlanFixture = dxfDocument([
  section('HEADER', header),
  section('TABLES', [
    ...table('LAYER', [layer('WALLS', false, 7), layer('OFF', true, 8), layer('TEXT', false, 1)]),
  ]),
  blocks,
  entities,
])
