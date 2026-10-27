import { expect, test } from 'bun:test'
import sharp from 'sharp'
import { sourceEnvelope } from '../src/workers/source-envelope'
import type { Intelligence } from '../src/contracts/analysis'
test('a coarse exterior edge follows a nearby real thick source wall without growing into white margins', async () => {
  const drawing = new Uint8Array(
    await sharp(
      Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" width="500" height="500"><rect width="500" height="500" fill="white"/><rect x="50" y="50" width="400" height="350" fill="none" stroke="black" stroke-width="5"/></svg>',
      ),
    )
      .png()
      .toBuffer(),
  )
  const empty = new Uint8Array(
    await sharp({ create: { width: 500, height: 500, channels: 3, background: 'white' } })
      .png()
      .toBuffer(),
  )
  const proposal: Intelligence = {
    coordinatesVersion: 1,
    coordinateSystem: 'normalized-image-top-left',
    warnings: [],
    candidates: [
      {
        id: 'south',
        kind: 'wall',
        wallKind: 'exterior',
        points: [
          { x: 0.1, y: 0.8 },
          { x: 0.9, y: 0.8 },
        ],
        thickness: 0.01,
        confidence: 0.9,
        evidence: 'Drawn south exterior wall',
        uncertainties: [],
        needsReview: true,
      },
    ],
    understanding: {
      buildingType: 'house',
      footprint: [
        { x: 0.1, y: 0.1 },
        { x: 0.9, y: 0.1 },
        { x: 0.9, y: 0.78 },
        { x: 0.1, y: 0.78 },
      ],
      circulation: [],
      conventions: [],
      uncertainties: [],
    },
  }
  const before = structuredClone(proposal)
  const fitted = await sourceEnvelope(proposal, drawing)
  expect(Math.max(...fitted.understanding!.footprint.map((p) => p.y))).toBeCloseTo(0.8)
  expect((await sourceEnvelope(proposal, empty)).understanding?.footprint).toEqual(
    proposal.understanding?.footprint,
  )
  expect(proposal).toEqual(before)
  proposal.candidates[0].points = proposal.candidates[0].points.map((p) => ({ ...p, y: 0.95 }))
  expect((await sourceEnvelope(proposal, drawing)).understanding?.footprint).toEqual(
    proposal.understanding?.footprint,
  )
})
