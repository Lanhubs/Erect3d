import { expect, test } from 'bun:test'
import { defaultRoof, type Building, type Level, type MassingSystem, type Wall } from '../src/domain/types'
import { sportsCategory, viewerBounds } from '../src/rendering/viewerBounds'

const p = (x: number, z: number) => ({ x, z })
const wall = (start: ReturnType<typeof p>, end: ReturnType<typeof p>, over: Partial<Wall> = {}): Wall => ({
  id: `wall-${start.x}-${start.z}`,
  start,
  end,
  thickness: 0.28,
  height: 2.9,
  material: 'plaster',
  ...over,
})

const level = (over: Partial<Level> = {}): Level => ({
  id: 'level-1',
  name: 'Ground floor',
  elevation: 0,
  walls: [wall(p(0, 0), p(6, 0)), wall(p(6, 0), p(6, 4))],
  doors: [],
  windows: [],
  rooms: [],
  slabThickness: 0.22,
  roof: { ...defaultRoof },
  ...over,
})

const building = (levels: Level[], over: Partial<Building> = {}): Building => ({
  id: 'building-1',
  name: 'Probe',
  levels,
  ...over,
})

const massing = (over: Partial<MassingSystem> = {}): MassingSystem => ({
  id: 'massing-1',
  name: 'Podium',
  levelId: 'level-1',
  origin: 'detected',
  evidence: 'test',
  color: '#cccccc',
  elevation: 0,
  kind: 'massing',
  role: 'podium',
  polygon: [p(0, 0), p(6, 0), p(6, 4), p(0, 4)],
  holes: [],
  height: 9,
  ...over,
})

test('the sliders never ask for a range narrower than the control floor', () => {
  const bounds = viewerBounds(building([level({ walls: [wall(p(1, 0), p(2, 0))] })]))
  expect(bounds).toEqual({ maxHeight: 5, maxX: 8, minX: 0 })
})

test('the section ceiling follows the tallest storey top, not the tallest wall', () => {
  expect(viewerBounds(building([level({ elevation: 0, floorToFloorHeight: 3 })])).maxHeight).toBe(5)
  expect(viewerBounds(building([level({ elevation: 12, floorToFloorHeight: 4 })])).maxHeight).toBe(16)
})

test('stacking levels widens the cut range instead of replacing it', () => {
  const bounds = viewerBounds(
    building([
      level({ id: 'level-1', elevation: 0, floorToFloorHeight: 3 }),
      level({ id: 'level-2', elevation: 3, floorToFloorHeight: 6, walls: [wall(p(-5, 0), p(11, 0))] }),
    ]),
  )
  expect(bounds.maxHeight).toBe(9)
  expect(bounds.maxX).toBe(11)
  expect(bounds.minX).toBe(-5)
})

test('a curved wall widens the range to its bulge, not just its endpoints', () => {
  const chord = [wall(p(0, -12), p(0, 12))]
  const bowed = [
    wall(p(0, -12), p(0, 12), {
      curve: { center: p(0, 0), radius: 12, startAngle: -Math.PI / 2, endAngle: Math.PI / 2 },
    }),
  ]
  expect(viewerBounds(building([level({ walls: chord })])).maxX).toBe(8)
  expect(viewerBounds(building([level({ walls: bowed })])).maxX).toBe(12)
})

test('a visible architectural system raises the cut ceiling above the storeys', () => {
  const systems = { version: 1 as const, typology: 'house' as const, systems: [massing()] }
  expect(viewerBounds(building([level()], { systems })).maxHeight).toBe(9)
  expect(
    viewerBounds(building([level()], { systems: { ...systems, systems: [massing({ visible: false })] } }))
      .maxHeight,
  ).toBe(5)
})

test('a sports room selects the camera preset family', () => {
  const withRoom = (category: string) =>
    building([
      level({
        rooms: [
          {
            id: 'room-1',
            name: 'Pitch',
            polygon: [p(0, 0), p(4, 0), p(4, 2)],
            material: 'concrete',
            category,
          },
        ],
      }),
    ])
  expect(sportsCategory(building([level()]))).toBeNull()
  expect(sportsCategory(withRoom('office'))).toBeNull()
  expect(sportsCategory(withRoom('football-pitch'))).toBe('stadium')
  expect(sportsCategory(withRoom('basketball-court'))).toBe('arena')
  expect(sportsCategory(withRoom('table-tennis-hall'))).toBe('arena')
})

test('the sports family on any level wins over the plain house presets', () => {
  const quiet = level({ id: 'level-1', rooms: [] })
  const court = level({
    id: 'level-2',
    rooms: [{ id: 'room-2', name: 'Court', polygon: [p(0, 0), p(4, 0), p(4, 2)], material: 'concrete' }],
  })
  court.rooms[0].category = 'basketball-court'
  expect(sportsCategory(building([quiet, court]))).toBe('arena')
})
