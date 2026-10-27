import type { Intelligence } from '../src/contracts/analysis'
export const labelFixture = (): Intelligence => ({
  coordinatesVersion: 1,
  coordinateSystem: 'normalized-image-top-left',
  warnings: [],
  candidates: [
    {
      id: 'scullery',
      kind: 'room',
      label: 'Scullery',
      points: [
        { x: 0.1, y: 0.1 },
        { x: 0.4, y: 0.1 },
        { x: 0.4, y: 0.4 },
        { x: 0.1, y: 0.4 },
      ],
      confidence: 0.9,
      evidence: 'Original source area',
      uncertainties: [],
      needsReview: true,
    },
  ],
  sourceText: {
    version: 1,
    status: 'ready',
    engine: 'tesseract-local',
    warnings: [],
    items: [
      {
        id: 'label',
        text: 'Scullery',
        confidence: 0.94,
        bounds: { x: 0.2, y: 0.2, width: 0.1, height: 0.02 },
      },
    ],
  },
})
