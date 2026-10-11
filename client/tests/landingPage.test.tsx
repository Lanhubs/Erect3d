import { describe, expect, test } from 'bun:test'
import ReactDOMServer from 'react-dom/server'
import { LandingPage } from '../src/features/landing/LandingPage'

describe('landing page', () => {
  test('explains the 2D-to-3D architectural workflow', () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      <LandingPage onStartDesigning={() => {}} onOpenWorkspace={() => {}} projects={[]} />,
    )

    expect(html).toContain('Design in 2D.')
    expect(html).toContain('Create or import floor plans')
    expect(html).toContain('Architectural floor plan with four rooms, doors and windows')
    expect(html).toContain('3D FLOOR PLAN')
    expect(html).toContain('Animated first-person interior walkthrough preview')
    expect(html).toContain('Architectural view previews')
    for (const component of ['Roof', 'Window', 'Door', 'Floor', 'Fence']) expect(html).toContain(component)
    for (const view of ['Plan', 'Model', 'Walk', 'Section']) expect(html).toContain(`>${view}</button>`)
  })
})
