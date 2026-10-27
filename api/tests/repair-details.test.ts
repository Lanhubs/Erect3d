import { expect, test } from 'bun:test'
import sharp from 'sharp'
import { repairSourceContext } from '../src/workers/repair-details'
import { repairContext } from '../src/workers/repair-context'
import type { IntelligenceInput } from '../src/modules/ai/provider'
import type { Intelligence } from '../src/contracts/analysis'

test('blocking geometry receives focused, lossless source detail before optional furnishing audits', async () => {
  const pixels = Buffer.from(Array.from({ length: 100 * 80 * 3 }, (_, index) => index % 253))
  const bytes = new Uint8Array(
    await sharp(pixels, { raw: { width: 100, height: 80, channels: 3 } })
      .png()
      .toBuffer(),
  )
  const source: IntelligenceInput = {
    bytes,
    mime: 'image/png',
    width: 100,
    height: 80,
    candidates: [],
    pass: 'reconstruct-model',
    model: 'fake',
  }
  const proposal: Intelligence = {
    coordinatesVersion: 1,
    coordinateSystem: 'normalized-image-top-left',
    warnings: [],
    candidates: [
      {
        id: 'door',
        kind: 'door',
        points: [
          { x: 0.45, y: 0.5 },
          { x: 0.55, y: 0.5 },
        ],
        confidence: 0.9,
        evidence: 'Source swing',
        uncertainties: [],
        needsReview: true,
      },
    ],
  }
  const quality = {
    status: 'blocked' as const,
    issues: [
      { code: 'INVALID_HOST', severity: 'error' as const, message: 'Review door', candidateId: 'door' },
      {
        code: 'ROOM_FIXTURES_UNCHECKED',
        severity: 'warning' as const,
        message: 'No furniture',
        candidateId: 'room',
      },
    ],
  }
  const context = await repairSourceContext(source, proposal, quality)
  expect(context.bytes).toBe(bytes)
  expect(context.validationIssues).toEqual(['INVALID_HOST: Review door'])
  expect(context.details).toHaveLength(1)
  const detail = context.details![0],
    region = detail.region
  const actual = await sharp(detail.bytes).raw().toBuffer({ resolveWithObject: true })
  const expected = await sharp(bytes)
    .extract({
      left: Math.floor(region.x * 100),
      top: Math.floor(region.y * 80),
      width: Math.round(region.width * 100),
      height: Math.round(region.height * 80),
    })
    .raw()
    .toBuffer()
  expect(actual.data).toEqual(expected)
  expect(actual.info.width).toBe(Math.round(region.width * 100))
  expect(
    (await repairSourceContext(source, proposal, { status: 'ready', issues: [] })).details,
  ).toBeUndefined()
  expect(
    repairContext(source, proposal, {
      status: 'needs-review',
      issues: [quality.issues[1]],
    }).validationIssues?.join(' '),
  ).toContain('missing sofa')
})
