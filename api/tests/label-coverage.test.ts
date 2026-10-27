import { expect, test } from 'bun:test'
import { labelCoverage } from '../src/modules/plan-analysis/label-coverage'
import { reconcile } from '../src/modules/ai/reconcile'
import { repairContext } from '../src/workers/repair-context'
import { compactReconstructionSchema } from '../src/modules/ai/compact-reconstruction'
import { responseSchema } from '../src/modules/ai/response-schema'
import { modelQuality } from '../src/modules/plan-analysis/quality'
import { canonicalLabelReadings } from '../src/modules/ai/label-wire'
import { compactSourceText } from '../src/modules/ai/compact-text'
import { labelFixture as source } from './label-fixture'
test('compact label transport preserves arbitrary text and validates typed readings locally', () => {
  const data = source(),
    wire = compactSourceText(data.sourceText)!
  expect(wire.items[0].slice(0, 3)).toEqual(['label', 'Scullery', 0.94])
  expect(canonicalLabelReadings([['label', 'space', 'Scullery', 'scullery', 'Drawn enclosure']])).toEqual([
    {
      sourceId: 'label',
      role: 'space',
      reading: 'Scullery',
      candidateIds: ['scullery'],
      reason: 'Drawn enclosure',
    },
  ])
  expect(JSON.stringify(compactReconstructionSchema(0, true))).not.toContain('prefixItems')
})
test('literal uncommon labels require a room at the printed location, rather than a common-room vocabulary', () => {
  const proposal = source()
  expect(labelCoverage(proposal)).toEqual([])
  proposal.candidates[0].label = 'Observatory & music studio'
  proposal.sourceText!.items[0].text = 'Observatory & music studio'
  expect(labelCoverage(proposal)).toEqual([])
  proposal.candidates[0].points = proposal.candidates[0].points.map((point) => ({
    ...point,
    x: point.x + 0.5,
  }))
  expect(labelCoverage(proposal)[0].code).toBe('SOURCE_LABEL_UNACCOUNTED')
})
test('a mapped space cannot be missing, elsewhere, named as a different room or replaced by its furniture', () => {
  for (const mode of ['missing', 'elsewhere', 'misnamed', 'furniture', 'text-box']) {
    const proposal = source()
    proposal.labelReadings = [
      {
        sourceId: 'label',
        role: 'space',
        reading: 'Scullery',
        candidateIds: ['scullery'],
        reason: 'Literal source label in enclosure',
      },
    ]
    if (mode === 'missing') proposal.candidates = []
    if (mode === 'elsewhere')
      proposal.candidates[0].points = proposal.candidates[0].points.map((point) => ({
        ...point,
        x: point.x + 0.5,
      }))
    if (mode === 'misnamed') proposal.candidates[0].label = 'Bedroom'
    if (mode === 'furniture') proposal.candidates[0].kind = 'furniture'
    if (mode === 'text-box')
      proposal.candidates[0].points = [
        { x: 0.2, y: 0.2 },
        { x: 0.3, y: 0.2 },
        { x: 0.3, y: 0.22 },
        { x: 0.2, y: 0.22 },
      ]
    expect(labelCoverage(proposal)[0].severity).toBe('error')
    expect(modelQuality(proposal).status).toBe('blocked')
  }
})
test('titles, dimensions and site notes are accounted for without becoming rooms; blurry text stays uncertain', () => {
  const proposal = source()
  for (const role of ['dimension', 'title', 'site', 'annotation', 'unreadable'] as const) {
    proposal.labelReadings = [
      { sourceId: 'label', role, reading: 'Source text', candidateIds: [], reason: 'Source-verified note' },
    ]
    expect(labelCoverage(proposal).length).toBe(role === 'unreadable' ? 1 : 0)
  }
})
test('an ambiguous low-confidence fragment is reviewable uncertainty rather than proof of a missing room', () => {
  const proposal = source()
  proposal.sourceText!.items[0].text = 'ST'
  proposal.sourceText!.items[0].confidence = 0.57
  proposal.sourceText!.items[0].bounds.x = 0.8
  proposal.labelReadings = [
    {
      sourceId: 'label',
      role: 'space',
      reading: 'STAIR',
      candidateIds: ['scullery'],
      reason: 'Possible stair label',
    },
  ]
  expect(labelCoverage(proposal)[0]).toMatchObject({ code: 'SOURCE_TEXT_UNCLEAR', severity: 'warning' })
  expect(modelQuality(proposal).status).toBe('needs-review')
  proposal.sourceText!.items[0].confidence = 0.94
  expect(modelQuality(proposal).status).toBe('blocked')
})
test('source labels inside circular architecture use physical image aspect, not a square normalized radius', () => {
  const proposal = source()
  proposal.candidates = [
    {
      ...proposal.candidates[0],
      kind: 'architectural-boundary',
      points: [
        { x: 0.47, y: 0.3 },
        { x: 0.53, y: 0.3 },
      ],
      curve: { center: { x: 0.5, y: 0.3 }, radius: 0.03, startAngle: Math.PI, endAngle: 0 },
    },
  ]
  proposal.sourceText!.items[0].bounds = { x: 0.49, y: 0.34, width: 0.02, height: 0.01 }
  proposal.labelReadings = [
    {
      sourceId: 'label',
      role: 'space',
      reading: 'Stair',
      candidateIds: ['scullery'],
      reason: 'Original circular stair',
    },
  ]
  expect(labelCoverage(proposal, { width: 1200, height: 600 })).toEqual([])
  proposal.sourceText!.items[0].bounds.x = 0.56
  expect(labelCoverage(proposal, { width: 1200, height: 600 })[0].code).toBe('SOURCE_SPACE_UNMODELED')
})
test('sparse repairs retain independent OCR inventory and untouched label mappings, and receive missing-label locations', () => {
  const proposal = source()
  proposal.sourceText!.items[0].text = 'Observatory'
  const issues = labelCoverage(proposal)
  const context = repairContext(
    {
      bytes: new Uint8Array([1]),
      mime: 'image/png',
      width: 1000,
      height: 800,
      pass: 'validated-model-repair',
      model: 'fake',
      candidates: [],
    },
    proposal,
    { status: 'needs-review', issues },
  )
  expect(context.candidates.find((candidate) => candidate.id === 'label')?.evidence).toContain(
    'NOT architectural geometry',
  )
  const patched = reconcile(
    [],
    [
      proposal,
      {
        ...source(),
        sourceText: undefined,
        candidates: [],
        labelReadings: [
          {
            sourceId: 'label',
            role: 'unreadable',
            reading: 'Observatory?',
            candidateIds: [],
            reason: 'Source is blurred',
          },
        ],
      },
    ],
    'full',
  )
  expect(patched.sourceText).toEqual(proposal.sourceText)
  expect(patched.labelReadings?.[0].role).toBe('unreadable')
  expect(compactReconstructionSchema(0, true).required as string[]).toContain('labelReadings')
  expect(
    (responseSchema('validated-model-repair', undefined, true).properties as Record<string, unknown>)
      .sourceText,
  ).toBeUndefined()
})
