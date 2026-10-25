import { expect, test } from 'bun:test'
import ReactDOMServer from 'react-dom/server'
import { Dashboard } from '../src/features/projects/Dashboard'
import { SampleLibrary } from '../src/features/projects/SampleLibrary'
import { fixtureProject } from '../src/domain/fixture'
import { createSampleLibrary } from '../src/domain/sampleLibrary'

test('Dashboard presents categorized, previewable real-model samples with open and duplicate actions', () => {
  const html = ReactDOMServer.renderToStaticMarkup(
    <SampleLibrary samples={createSampleLibrary()} openSample={() => {}} />,
  )
  for (const title of [
    'Willow Court House',
    'Juniper Ridge Villa',
    'Meridian Apartments',
    'Northline Studio Offices',
    'Central Walk Mall',
    'Harbor Civic Forum',
  ])
    expect(html).toContain(title)
  expect(html).toContain('Maple House · furnished walkthrough')
  expect(html).toContain('Asterion Tower')
  expect(html).toContain('48 storeys')
  expect(html).toContain('7 editable layouts')
  expect(html).toContain('/samples/asterion-tower.webp')
  expect(html).toContain('actual editable 3D model')
  expect((html.match(/Preview plan/g) || []).length).toBe(8)
  expect((html.match(/>Open sample<\/button>/g) || []).length).toBe(8)
  expect((html.match(/>Duplicate<\/button>/g) || []).length).toBe(8)
  expect(html).not.toContain('Eastbank')
  expect(html).not.toContain('Public / Sports')
  expect(html).not.toContain('Cloud projects')
  expect(html).not.toContain('Local projects')
}, 15000)
test('Dashboard never invents a template catalogue when the backend is unavailable', () => {
  const html = ReactDOMServer.renderToStaticMarkup(
    <SampleLibrary samples={[]} samplesError="Templates require a connection" openSample={() => {}} />,
  )
  expect(html).not.toContain('Willow Court House')
  expect(html).toContain('Templates require a connection')
})
test('Projects opens as a compact browser without rendering templates or a creation form', () => {
  const html = ReactDOMServer.renderToStaticMarkup(
    <Dashboard
      projects={[]}
      samples={[
        {
          id: 'tower',
          category: 'Commercial',
          title: 'Asterion Tower',
          description: 'Deferred template',
          project: fixtureProject(),
        },
      ]}
      open={() => {}}
      openSample={() => {}}
      create={() => {}}
      remove={() => {}}
    />,
  )
  expect(html).toContain('Your projects')
  expect(html).toContain('Search projects')
  expect(html).toContain('Templates')
  expect(html).not.toContain('Asterion Tower')
  expect(html).not.toContain('aria-label="Project name"')
  expect(html).toContain('3D renderer')
  expect(html).not.toContain('List view')
  expect(html).not.toContain('Grid view')
})
