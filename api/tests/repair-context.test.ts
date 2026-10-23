import { expect, test } from 'bun:test'
import { repairContext, needsSourceRepair } from '../src/workers/repair-context'
import type { IntelligenceInput } from '../src/modules/ai/provider'
import type { Intelligence } from '../src/contracts/analysis'
test('local host repair retains native pixels and floor understanding without re-sending a complete PDF or design image', () => {
  const bytes = new Uint8Array([1, 2, 3]),
    source: IntelligenceInput = {
      bytes,
      mime: 'image/png',
      width: 1000,
      height: 800,
      candidates: [],
      pass: 'validated-model-repair',
      model: 'fake',
      document: { bytes, mime: 'application/pdf', page: 3 },
      designReference: { bytes, mime: 'image/png' },
    }
  const proposal: Intelligence = {
    coordinatesVersion: 1,
    coordinateSystem: 'normalized-image-top-left',
    candidates: [],
    warnings: [],
    understanding: {
      buildingType: 'office',
      footprint: [],
      conventions: [],
      circulation: [],
      uncertainties: [],
    },
  }
  const issue = { code: 'INVALID_HOST', severity: 'error' as const, message: 'Fix door host' }
  const local = repairContext(source, proposal, { status: 'blocked', issues: [issue] })
  expect(local.bytes).toBe(bytes)
  expect(local.understanding).toBe(proposal.understanding)
  expect(local.document).toBeUndefined()
  expect(local.designReference).toBeUndefined()
  expect(source.document?.page).toBe(3)
  expect(
    repairContext(source, proposal, {
      status: 'blocked',
      issues: [{ ...issue, code: 'ARCHITECTURE_DIMENSIONS_REQUIRED' }],
    }).document,
  ).toBe(source.document)
  const coverage = {
    status: 'needs-review' as const,
    issues: [{ code: 'NO_WINDOWS', severity: 'warning' as const, message: 'No window was established' }],
  }
  const details = [{ bytes, mime: 'image/png', region: { x: 0.5, y: 0.5, width: 0.5, height: 0.5 } }]
  const check = repairContext({ ...source, details }, proposal, coverage)
  expect(needsSourceRepair(coverage)).toBe(true)
  expect(needsSourceRepair({ status: 'ready', issues: [] })).toBe(false)
  expect(check.details).toBe(details)
  expect(check.validationIssues?.[0]).toContain('NO_WINDOWS')
  expect(check.validationIssues?.at(-1)).toContain('never invent openings')
})
