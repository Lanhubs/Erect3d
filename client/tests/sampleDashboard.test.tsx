import { expect, test } from 'bun:test'
import ReactDOMServer from 'react-dom/server'
import { Dashboard } from '../src/features/projects/Dashboard'
import { createSampleLibrary } from '../src/domain/sampleLibrary'

test('Dashboard presents categorized, previewable real-model samples with open and duplicate actions', () => {
  const html = ReactDOMServer.renderToStaticMarkup(<Dashboard projects={[]} samples={createSampleLibrary()} open={() => {}} openSample={() => {}}
    create={() => {}} remove={() => {}} />)
  for (const title of ['Willow Court House', 'Juniper Ridge Villa', 'Meridian Apartments', 'Northline Studio Offices',
    'Central Walk Mall', 'Harbor Civic Forum', 'Eastbank Championship Ground', 'Eastbank Indoor Arena']) expect(html).toContain(title)
  expect(html).toContain('Maple House · furnished walkthrough')
  expect((html.match(/Preview plan/g) || []).length).toBe(9)
  expect((html.match(/>Open sample<\/button>/g) || []).length).toBe(9)
  expect((html.match(/>Duplicate<\/button>/g) || []).length).toBe(9)
  expect(html).not.toContain('Cloud projects');expect(html).not.toContain('Local projects')
})
test('Dashboard never invents a template catalogue when the backend is unavailable',()=>{
  const html=ReactDOMServer.renderToStaticMarkup(<Dashboard projects={[]} samples={[]} samplesError="Templates require a connection" open={()=>{}} openSample={()=>{}} create={()=>{}} remove={()=>{}}/>)
  expect(html).not.toContain('Willow Court House');expect(html).toContain('Templates require a connection')
})
