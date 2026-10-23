import { expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { fixtureProject } from '../src/domain/fixture'
import { newFurniture } from '../src/furniture/entities'
import { useFurnitureReview } from '../src/furniture/reviewState'
import { FurniturePanel } from '../src/furniture/FurniturePanel'
import { FurnitureReview } from '../src/furniture/FurnitureReview'
import { FurnitureLayer } from '../src/furniture/FurnitureLayer'
import { filterWallNetwork } from '../src/workers/wallNetwork'
test('furniture interpretation defaults off and review exposes accepted, rejected and uncertain source overlays', () => {
  const level = fixtureProject().buildings[0].levels[0]
  level.sourceId = 'source'
  const panel = renderToStaticMarkup(
    <FurniturePanel
      level={level}
      levels={[level]}
      walls={[]}
      rooms={[]}
      completed={false}
      select={() => {}}
    />,
  )
  expect(panel).toContain('Interpret furniture with plan analysis')
  expect(panel).toContain('Analyze furniture from source')
  expect(panel.match(/<input type="checkbox"[^>]*>/)?.[0]).not.toContain('checked')
  const object = newFurniture(level, 'bed', { x: 2, z: 2 })
  const candidates = (['accepted', 'rejected', 'uncertain'] as const).map((status, i) => ({
    ...object,
    id: `proposal:${i}`,
    status,
    confidence: 0.8,
    sourceBounds: { x: 10, y: 10, width: 50, height: 80 },
    issues: [],
  }))
  useFurnitureReview.getState().begin(`${level.id}:source`, candidates)
  // Zustand uses its initial snapshot during server rendering, rather than its live client snapshot.
  const initialSnapshot = useFurnitureReview.getInitialState(),
    previousSnapshot = { ...initialSnapshot }
  Object.assign(initialSnapshot, useFurnitureReview.getState())
  try {
    const review = renderToStaticMarkup(<FurnitureReview level={level} levels={[level]} />)
    for (const label of [
      'Needs review',
      'Accept',
      'Reject',
      'Delete proposal',
      'Proposal rotation',
      'Proposal width',
      'Proposal depth',
    ])
      expect(review).toContain(label)
    const overlay = renderToStaticMarkup(
      <svg>
        <FurnitureLayer level={level} selection={null} select={() => {}} />
      </svg>,
    )
    for (const color of ['#387855', '#a95858', '#b08222']) expect(overlay).toContain(color)
    useFurnitureReview.getState().consumeAccepted()
    expect(useFurnitureReview.getState().candidates.map((item) => item.status)).toEqual([
      'rejected',
      'uncertain',
    ])
  } finally {
    Object.assign(initialSnapshot, previousSnapshot)
    useFurnitureReview.getState().clear()
  }
})
test('an isolated thin symbol box cannot gain wall status merely from its own connected corners', () => {
  const box = (x: number, y: number, w: number, h: number, thicknessPixels: number) =>
    [
      { x1: x, y1: y, x2: x + w, y2: y },
      { x1: x + w, y1: y, x2: x + w, y2: y + h },
      { x1: x + w, y1: y + h, x2: x, y2: y + h },
      { x1: x, y1: y + h, x2: x, y2: y },
    ].map((line) => ({ ...line, thicknessPixels }))
  const structural = box(10, 10, 480, 380, 8),
    symbol = box(100, 100, 40, 70, 1)
  const walls = filterWallNetwork([...structural, ...symbol], 600, 500)
  expect(walls).toHaveLength(4)
  expect(walls.every((wall) => wall.thicknessPixels === 8)).toBe(true)
})
