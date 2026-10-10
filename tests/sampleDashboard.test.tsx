import { expect, test } from 'bun:test'
import ReactDOMServer from 'react-dom/server'
import { Dashboard } from '../src/features/projects/Dashboard'

test('Dashboard presents categorized, previewable real-model samples with open and duplicate actions', () => {
  const html = ReactDOMServer.renderToStaticMarkup(<Dashboard projects={[]} open={() => {}} openSample={() => {}}
    create={() => {}} remove={() => {}} />)
  for (const title of ['Willow Court House', 'Juniper Ridge Villa', 'Meridian Apartments', 'Northline Studio Offices',
    'Central Walk Mall', 'Harbor Civic Forum', 'Eastbank Championship Ground', 'Eastbank Indoor Arena']) expect(html).toContain(title)
  expect((html.match(/Preview plan/g) || []).length).toBe(8)
  expect((html.match(/>Open sample<\/button>/g) || []).length).toBe(8)
  expect((html.match(/>Duplicate<\/button>/g) || []).length).toBe(8)
})
