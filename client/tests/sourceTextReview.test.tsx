import { expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { SourceTextReview } from '../src/cloud/SourceTextReview'
import type { Intelligence } from '../../api/src/contracts/analysis'
test('text review preserves uncommon names, shows uncertainty and escapes source markup', () => {
  const proposal: Intelligence = {
    coordinatesVersion: 1,
    coordinateSystem: 'normalized-image-top-left',
    candidates: [],
    warnings: [],
    sourceText: {
      version: 1,
      engine: 'tesseract-local',
      status: 'partial',
      warnings: ['Check blurred text'],
      items: [
        {
          id: 'source_text_0',
          text: 'OBSERVATORY <script>',
          confidence: 0.61,
          bounds: { x: 0.2, y: 0.2, width: 0.1, height: 0.04 },
        },
      ],
    },
  }
  const html = renderToStaticMarkup(<SourceTextReview proposal={proposal} />)
  expect(html).toContain('1 readings')
  expect(html).toContain('1 need review')
  expect(html).toContain('OBSERVATORY &lt;script&gt;')
  expect(html).not.toContain('<script>')
  expect(html).toContain('confidence 61')
  expect(html).toContain('Text reading was incomplete')
  expect(renderToStaticMarkup(<SourceTextReview proposal={{ ...proposal, sourceText: undefined }} />)).toBe(
    '',
  )
})
