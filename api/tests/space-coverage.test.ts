import { expect, test } from 'bun:test'
import { fixture } from './helpers'
import { spaceCoverage } from '../src/modules/plan-analysis/space-coverage'
import { spaceRepairTargets } from '../src/workers/space-targets'
import { newSlab } from '../../client/src/domain/levels'
const rect = (x: number, z: number, w: number, h: number) => [
  { x, z },
  { x: x + w, z },
  { x: x + w, z: z + h },
  { x, z: z + h },
]
function plan() {
  const p = fixture(),
    l = p.buildings[0].levels[0],
    ring = rect(0, 0, 8, 4)
  l.walls = ring.map((start, i) => ({
    id: `wall${i}`,
    start,
    end: ring[(i + 1) % 4],
    height: 3,
    thickness: 0.2,
    material: 'plaster',
  }))
  l.walls.push({
    id: 'partition',
    start: { x: 4, z: 0 },
    end: { x: 4, z: 4 },
    height: 3,
    thickness: 0.2,
    material: 'plaster',
  })
  l.rooms = [{ id: 'one', name: 'Study', polygon: rect(0, 0, 4, 4), material: 'tile' }]
  l.calibration = { a: { x: 0, z: 0 }, b: { x: 100, z: 0 }, knownMetres: 10, metresPerPixel: 0.1 }
  return l
}
test('a missing enclosed wing is audited with a source-local repair region', () => {
  const l = plan(),
    issues = spaceCoverage(l, { width: 100, height: 100 })
  expect(issues).toHaveLength(1)
  expect(issues[0].code).toBe('UNASSIGNED_ENCLOSURE')
  expect(issues[0].sourceRegion).toEqual({ x: 0.4, y: 0, width: 0.4, height: 0.4 })
  const targets = spaceRepairTargets({ status: 'needs-review', issues })
  expect(targets[0].kind).toBe('unknown')
  expect(targets[0].needsReview).toBe(true)
})
test('represented courtyards and explicit slab voids are not fabricated as missing rooms', () => {
  const l = plan()
  l.rooms.push({ id: 'court', name: 'Courtyard', material: 'concrete', polygon: rect(4, 0, 4, 4) })
  expect(spaceCoverage(l)).toEqual([])
  l.rooms.pop()
  l.slabs = [newSlab(rect(0, 0, 8, 4))]
  l.slabs[0].openings = [{ id: 'void', kind: 'void', polygon: rect(4, 0, 4, 4) }]
  expect(spaceCoverage(l)).toEqual([])
})
test('white image margins, open exterior lines and separate unenclosed landscaping create no rooms', () => {
  const l = plan()
  l.walls = []
  l.rooms = []
  l.walls.push({
    id: 'site-line',
    start: { x: 0, z: 0 },
    end: { x: 80, z: 0 },
    height: 3,
    thickness: 0.2,
    material: 'plaster',
  })
  expect(spaceCoverage(l, { width: 2000, height: 1000 })).toEqual([])
})
