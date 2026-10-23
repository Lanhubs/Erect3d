import { expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { NewProjectDialog } from '../src/features/projects/NewProjectDialog'
import { SourceNotice } from '../src/app/SourceNotice'
import { LevelManager } from '../src/features/levels/LevelManager'
import { StructurePanel } from '../src/features/structure/StructurePanel'
import { FurniturePanel } from '../src/furniture/FurniturePanel'
import { fixtureProject } from '../src/domain/fixture'
import { newSlab } from '../src/domain/levels'

const ignore = () => {}

test('project creation retains accessible fields and a blocked state never offers an enabled submit', () => {
  const html = renderToStaticMarkup(
    <NewProjectDialog close={ignore} create={ignore} blocked error="Connection unavailable" />,
  )
  for (const label of ['Project name', 'Building name', 'Display units', 'Close new project'])
    expect(html).toContain(`aria-label="${label}"`)
  expect(html).toContain('aria-modal="true"')
  expect(html).toContain('role="alert"')
  expect(html).toContain('keep editing opened projects offline')
  expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Create project<\/button>/)
  const busy = renderToStaticMarkup(<NewProjectDialog close={ignore} create={ignore} busy />)
  expect(busy).toContain('Creating…')
})

test('source review keeps low-resolution plans editable and preserves PDF page bounds and errors', () => {
  const html = renderToStaticMarkup(
    <SourceNotice
      source={{ id: 'source', name: 'small.pdf', mime: 'application/pdf', width: 205, height: 180 }}
      error="Read failed"
      analysisError="Review ambiguous walls"
      busy
      pages={4}
      page={2}
      setPage={ignore}
      selectPage={async () => true}
      onLoaded={ignore}
    />,
  )
  expect(html).toContain('Low-resolution plan')
  expect(html).toContain('edit the result in 2D')
  expect(html).toContain('Preparing source document')
  expect(html).toContain('min="1" max="4"')
  expect(html).toContain('value="2"')
  expect(html).toContain('Load page')
  expect(html).toContain('Read failed')
  expect(html).toContain('Review ambiguous walls')
  expect(html).not.toContain('must be at least 300')
})

test('level controls retain distinct floors, offsets, visibility and isolation choices', () => {
  const project = fixtureProject(),
    ground = project.buildings[0].levels[0]
  const upper = structuredClone(ground)
  upper.id = 'control-upper'
  upper.name = 'Upper regression floor'
  upper.elevation = 3.2
  project.buildings[0].levels = [ground, upper]
  const before = JSON.stringify(project)
  const html = renderToStaticMarkup(
    <LevelManager
      project={project}
      activeId={upper.id}
      isolateId={null}
      setIsolateId={ignore}
      underlayId={ground.id}
      setUnderlayId={ignore}
      embedded
    />,
  )
  for (const text of [
    'Upper regression floor',
    '3.20 m',
    'Show all',
    'Floor to floor height',
    'Plan offset X',
    'Plan offset Z',
  ])
    expect(html).toContain(text)
  expect(html).toContain('aria-current="true"')
  expect(JSON.stringify(project)).toBe(before)
})

test('structural editing shows slab outlines, materials and managed stair openings without changing the model', () => {
  const project = fixtureProject(),
    level = project.buildings[0].levels[0]
  const slab = newSlab(
    [
      { x: 0, z: 0 },
      { x: 8, z: 0 },
      { x: 8, z: 6 },
      { x: 0, z: 6 },
    ],
    0.2,
  )
  slab.openings = [
    {
      id: 'stair-opening',
      kind: 'stair',
      polygon: [
        { x: 1, z: 1 },
        { x: 2, z: 1 },
        { x: 2, z: 2 },
        { x: 1, z: 2 },
      ],
    },
  ]
  level.slabs = [slab]
  const before = JSON.stringify(project)
  const html = renderToStaticMarkup(
    <StructurePanel project={project} level={level} select={ignore} embedded />,
  )
  for (const text of [
    'Reinforced concrete',
    'Steel deck',
    'Edit slab outline',
    '4 vertices',
    'Managed by stair',
    'Add opening',
  ])
    expect(html).toContain(text)
  expect(JSON.stringify(project)).toBe(before)
})

test('locked floors preserve furniture visibility and library controls while disabling placement and source analysis', () => {
  const project = fixtureProject(),
    level = project.buildings[0].levels[0]
  level.locked = true
  const html = renderToStaticMarkup(
    <FurniturePanel
      level={level}
      levels={project.buildings[0].levels}
      walls={[]}
      rooms={[]}
      completed={false}
      select={ignore}
      embedded
    />,
  )
  expect(html).toContain('aria-label="Furniture to place"')
  expect(html).toContain('aria-pressed="true"')
  expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Analyze furniture from source<\/button>/)
  expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Place furniture<\/button>/)
})
