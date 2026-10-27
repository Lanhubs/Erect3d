import { expect, test } from 'bun:test'
import { modelQuality } from '../src/modules/plan-analysis/quality'
import type { Intelligence } from '../src/contracts/analysis'
test('large label inventories cannot hide a blocking missing area behind warning limits', () => {
  const proposal: Intelligence = {
    coordinatesVersion: 1,
    coordinateSystem: 'normalized-image-top-left',
    warnings: [],
    candidates: [],
    sourceText: {
      version: 1,
      engine: 'tesseract-local',
      status: 'ready',
      warnings: [],
      items: Array.from({ length: 150 }, (_, i) => ({
        id: `label_${i}`,
        text: `Area ${i}`,
        confidence: 0.95,
        bounds: { x: 0.2, y: 0.2, width: 0.1, height: 0.02 },
      })),
    },
    labelReadings: [
      {
        sourceId: 'label_149',
        role: 'space',
        reading: 'Observatory',
        candidateIds: ['missing-room'],
        reason: 'Clearly labelled source area',
      },
    ],
  }
  const result = modelQuality(proposal)
  expect(result.status).toBe('blocked')
  expect(result.issues).toHaveLength(100)
  expect(result.issues[0]).toMatchObject({
    code: 'SOURCE_SPACE_UNMODELED',
    candidateId: 'label_149',
    severity: 'error',
  })
})
