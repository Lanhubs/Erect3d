import { architecturalRequirements } from '../../contracts/architectural-requirements'
import { typology } from '../../contracts/architecture'
import { windowConstructionSchema } from '../../contracts/opening-construction'
import { z } from 'zod'
import { intelligenceSchema, type Candidate } from '../../contracts/analysis'
import { furnitureTypes } from '../../../../client/src/furniture/types'
import { visionSchema } from '../../contracts/vision'
import { compactGenerationSchema } from './compact-schema'
import { classifyStrokes, confirmedSourceSymbols } from './stroke-classification'
import { labelReadingWire, canonicalLabelReadings } from './label-wire'
const coord = z.number().min(0).max(1),
  point = z.tuple([coord, coord]),
  points = z.array(point).min(1).max(1024)
const entity = { id: z.string().min(1).max(160), points }
const curve = z
  .object({
    center: point,
    radius: z.number().positive().max(2),
    startAngle: z.number(),
    endAngle: z.number(),
  })
  .strict()
export const compactReconstruction = z
  .object({
    labelReadings: labelReadingWire.optional(),
    architecturalRequirements: architecturalRequirements.optional(),
    buildingType: typology,
    footprint: points,
    vision: visionSchema.optional(),
    boundaries: z
      .array(z.object({ ...entity, curve: curve.optional() }).strict())
      .max(200)
      .optional(),
    scale: z
      .object({
        a: point,
        b: point,
        knownMetres: z.number().positive().max(10000),
        origin: z.enum(['annotated', 'inferred']),
        evidence: z.string().min(1).max(1000),
      })
      .strict()
      .optional(),
    walls: z
      .array(
        z
          .object({
            ...entity,
            thickness: z.number().positive().max(0.1).optional(),
            wallKind: z.enum(['exterior', 'interior', 'partition']).optional(),
            curve: curve.optional(),
          })
          .strict(),
      )
      .max(1000),
    wallRefs: z.array(z.number().int().nonnegative().max(1999)).max(1000).optional(),
    classification: z.literal('wall-refs-v1').optional(),
    detailRefs: z.array(z.string().min(1).max(160)).max(200).optional(),
    uncertainWallRefs: z.array(z.number().int().nonnegative().max(1999)).max(1000).optional(),
    strokeLabels: z.record(z.string(), z.string().regex(/^[012]*$/)).optional(),
    openings: z
      .array(
        z
          .object({
            ...entity,
            kind: z.enum(['door', 'window', 'passage']),
            wallId: z.string().min(1).optional(),
            wallRef: z.number().int().nonnegative().max(1999).optional(),
            doorStyle: z.enum(['flush', 'panel', 'glazed', 'double', 'sectional']).optional(),
            doorLeafStyle: z.enum(['flush', 'panel', 'glazed']).optional(),
            hinge: z.enum(['left', 'right']).optional(),
            swing: z.enum(['in', 'out']).optional(),
            windowType: z.enum(['fixed', 'casement', 'sliding']).optional(),
            windowConstruction: windowConstructionSchema.optional(),
          })
          .strict(),
      )
      .max(500),
    windows: z
      .array(
        z
          .object({
            ...entity,
            wallId: z.string().min(1).optional(),
            wallRef: z.number().int().nonnegative().max(1999).optional(),
            windowType: z.enum(['fixed', 'casement', 'sliding']).optional(),
            windowConstruction: windowConstructionSchema.optional(),
          })
          .strict(),
      )
      .max(500)
      .optional(),
    rooms: z
      .array(
        z
          .object({
            ...entity,
            name: z.string().max(200),
            roomCategory: z.enum(['basketball-court', 'football-pitch', 'table-tennis-hall']).optional(),
          })
          .strict(),
      )
      .max(200),
    columns: z
      .array(z.object({ ...entity, columnShape: z.enum(['rectangular', 'circular']).optional() }).strict())
      .max(200),
    stairs: z
      .array(
        z
          .object({
            ...entity,
            stairForm: z.enum(['straight', 'L', 'U']).optional(),
            reverse: z.boolean().optional(),
          })
          .strict(),
      )
      .max(100),
    fixtures: z
      .array(
        z
          .object({
            ...entity,
            type: z.enum(furnitureTypes),
            furnitureRotation: z.number().min(-360).max(360).optional(),
            furnitureVariant: z.string().max(80).optional(),
            heightMetres: z.number().positive().max(10).optional(),
          })
          .strict(),
      )
      .max(200),
    warnings: z.array(z.string().max(1000)).max(40),
  })
  .strict()
const imagePoint = ([x, y]: [number, number]) => ({ x, y })
export function expandReconstruction(value: unknown, measurements: Candidate[] = []) {
  const parsed = compactReconstruction.parse(value)
  const candidate = (
    item: z.infer<typeof compactReconstruction>['walls'][number],
    kind: Candidate['kind'],
  ): Candidate => ({
    ...item,
    kind,
    points: item.points.map(imagePoint),
    curve: item.curve ? { ...item.curve, center: imagePoint(item.curve.center) } : undefined,
    confidence: 0.8,
    evidence: 'Source geometry traced in a coordinated full-plan interpretation.',
    uncertainties: ['Vertical dimensions are defaults unless independently established.'],
    needsReview: true,
  })
  const measured = measurements.filter((item) => item.kind === 'wall')
  const { labels, selected } = classifyStrokes(parsed, measured.length)
  const references = selected.map((ref) => {
    const wall = measured[ref]
    if (!wall) throw new Error('Unknown measured wall reference')
    return {
      ...wall,
      confidence: 0.8,
      needsReview: true as const,
      evidence: 'Native source stroke classified as a building wall in the complete-plan interpretation.',
    }
  })
  const candidates = [
    ...references,
    ...confirmedSourceSymbols(parsed.detailRefs, measurements),
    ...(parsed.boundaries || []).map((item) => candidate(item, 'architectural-boundary')),
    ...parsed.walls.map((item) => candidate(item, 'wall')),
    ...[
      ...parsed.openings,
      ...(parsed.windows || []).map((item) => ({ ...item, kind: 'window' as const })),
    ].map(({ wallRef, ...item }) => {
      const wallId = wallRef === undefined ? item.wallId : measured[wallRef]?.id
      if (wallRef !== undefined && !wallId) throw new Error('Unknown opening host reference')
      const hosted = { ...item, wallId }
      return candidate(hosted, item.kind)
    }),
    ...parsed.columns.map((item) => candidate(item, 'column')),
    ...parsed.stairs.map((item) => candidate(item, 'stair')),
    ...parsed.rooms.map(({ name, ...item }) => ({ ...candidate(item, 'room'), label: name })),
    ...parsed.fixtures.map(({ type, ...item }) => ({ ...candidate(item, 'furniture'), furnitureType: type })),
  ]
  return intelligenceSchema.parse({
    coordinatesVersion: 1,
    coordinateSystem: 'normalized-image-top-left',
    candidates,
    labelReadings: canonicalLabelReadings(parsed.labelReadings),
    warnings: parsed.warnings,
    vision: parsed.vision,
    architecturalRequirements: parsed.architecturalRequirements,
    dispositions: labels.map((label, ref) => ({
      candidateId: measured[ref].id,
      decision: label === '1' ? 'confirm' : label === '0' ? 'reject' : 'defer',
      reason:
        label === '1'
          ? 'Source stroke represents an architectural wall'
          : label === '0'
            ? 'Source stroke is non-wall detail or a duplicate edge'
            : 'Source stroke is ambiguous',
    })),
    understanding: {
      buildingType: parsed.buildingType,
      footprint: parsed.footprint.map(imagePoint),
      conventions: [],
      circulation: [],
      uncertainties: parsed.warnings.slice(0, 20),
      scale: parsed.scale
        ? {
            ...parsed.scale,
            origin: /standard|regulation|typical|fiba/i.test(parsed.scale.evidence)
              ? 'inferred'
              : parsed.scale.origin,
            a: imagePoint(parsed.scale.a),
            b: imagePoint(parsed.scale.b),
          }
        : undefined,
    },
  })
}
export function compactMeasurements(items: Candidate[]) {
  // The response references the untouched measurements. Rounding only the numeric
  // prompt removes floating-point noise; erected geometry retains original precision.
  const short = (number: number) => Number(number.toFixed(6))
  return items
    .filter((item) => item.kind === 'wall')
    .map((item, ref) => [
      ref,
      ...item.points.flatMap(({ x, y }) => [short(x), short(y)]),
      short(item.thickness || 0),
    ])
}
// A bounded, spatially distributed set of native frame/leaf hints accompanies
// the untouched image. These are evidence, never automatically erected lines.
export function compactSourceFeatures(items: Candidate[]) {
  const features = items.filter((item) => item.id.startsWith('cv_feature_'))
  const swings = features.filter((item) => item.evidence.includes('swing')).slice(0, 128),
    rest = features.filter((item) => !swings.includes(item)),
    budget = 256 - swings.length
  const selected = [
    ...swings,
    ...Array.from(
      { length: Math.min(budget, rest.length) },
      (_, i) => rest[Math.floor((i * rest.length) / Math.min(budget, rest.length))],
    ),
  ]
  return selected.map((item) => [
    item.id,
    ...item.points.flatMap((p) => [Number(p.x.toFixed(6)), Number(p.y.toFixed(6))]),
    item.evidence.includes('swing') ? 'swing' : 'thin-line',
  ])
}
// Gemini accepts homogeneous numeric arrays; full tuple lengths are checked locally.
export function compactReconstructionSchema(
  _measurementCount?: number,
  withText = false,
): Record<string, unknown> {
  return compactGenerationSchema(z.toJSONSchema(compactReconstruction), withText)
}
