import type { BuildingDesign } from '../src/modules/assistant/building-design-schema'
const rect = (x: number, z: number, w: number, h: number) => [
  { x, z },
  { x: x + w, z },
  { x: x + w, z: z + h },
  { x, z: z + h },
]
export function buildingDesignFixture(): BuildingDesign {
  const ring = rect(0, 0, 14, 12)
  const floors = ['Ground floor', 'First floor'].map((name, index) => ({
    ref: `floor${index}`,
    name,
    height: 3.4,
    layout: {
      rooms: [
        {
          name: index ? 'Primary suite' : 'Reception lounge',
          polygon: rect(0, 0, 8, 8),
          material: 'timber' as const,
        },
        { name: 'Stair hall', polygon: rect(8, 0, 6, 8), material: 'tile' as const },
        {
          name: index ? 'Guest suite' : 'Dining room',
          polygon: rect(0, 8, 14, 4),
          material: 'timber' as const,
        },
      ],
      walls: [
        ...ring.map((start, i) => ({
          ref: `outer${i}`,
          start,
          end: ring[(i + 1) % 4],
          height: 3.4,
          thickness: 0.2,
          material: 'plaster' as const,
        })),
        {
          ref: 'partition',
          start: { x: 8, z: 0 },
          end: { x: 8, z: 8 },
          height: 3.4,
          thickness: 0.15,
          material: 'plaster' as const,
        },
        {
          ref: 'cross',
          start: { x: 0, z: 8 },
          end: { x: 14, z: 8 },
          height: 3.4,
          thickness: 0.15,
          material: 'plaster' as const,
        },
      ],
      doors: [
        { hostRef: 'partition', offset: 3, width: 1.2, height: 2.4, hinge: 'left' as const },
        { hostRef: 'cross', offset: 10, width: 1.2, height: 2.4, hinge: 'left' as const },
        ...(!index
          ? [
              {
                hostRef: 'outer0',
                offset: 10,
                width: 1.4,
                height: 2.4,
                hinge: 'left' as const,
                style: 'double' as const,
                leafStyle: 'glazed' as const,
              },
            ]
          : []),
      ],
      windows: [
        { hostRef: 'outer0', offset: 2, width: 2, height: 1.8, sill: 0.5, mullions: 3 },
        { hostRef: 'outer2', offset: 2, width: 2, height: 1.8, sill: 0.5, mullions: 3 },
      ],
    },
    furniture: [
      {
        type: index ? ('bed' as const) : ('sofa' as const),
        assetId: index ? 'bed' : 'sofa',
        roomName: index ? 'Primary suite' : 'Reception lounge',
        position: { x: 4, z: 4 },
        rotation: 0,
        width: 2.2,
        depth: 2,
        height: 1,
      },
      {
        type: index ? ('bed' as const) : ('dining-table' as const),
        assetId: index ? 'bed' : 'dining-table',
        roomName: index ? 'Guest suite' : 'Dining room',
        position: { x: 4, z: 10 },
        rotation: 0,
        width: 2,
        depth: 1.6,
        height: 1,
      },
    ],
    details: [
      {
        name: 'Timber entrance screen',
        kind: 'screen' as const,
        start: { x: 8.2, z: 0.1 },
        end: { x: 13.8, z: 0.1 },
        baseElevation: 0,
        height: 2.5,
        depth: 0.08,
        spacing: 0.2,
        material: 'timber' as const,
        color: '#882c24',
      },
    ],
  }))
  return {
    name: 'Courtyard Mansion',
    style: 'Chinese-inspired',
    roof: { shape: 'hip', material: 'clay-tile', color: '#514c48', pitch: 28, overhang: 1.1 },
    floors,
    stairs: [{ fromRef: 'floor0', toRef: 'floor1', start: { x: 10, z: 2 }, width: 1.2, form: 'U' }],
  }
}
