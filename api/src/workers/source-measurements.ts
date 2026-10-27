import sharp from 'sharp'
import type { Candidate, Intelligence } from '../contracts/analysis'
import { analyzePlan } from '../../../client/src/workers/analyze'
import { scanWallEdges } from '../../../client/src/workers/outlineWalls'
import type { SourceRegion } from './source-region'
import { coveredStroke } from './covered-stroke'
import { respectMeasurementFootprint } from './measurement-footprint'
import { inSourceRegion } from './source-region'
import { neutralInk } from './neutral-ink'
export async function measureReconstructionSource(
  backend: boolean,
  bytes: Uint8Array,
  region?: SourceRegion,
) {
  if (!backend) return undefined
  const result = await measureSource(bytes, region)
  return { ...result, candidates: result.candidates.filter((candidate) => inSourceRegion(candidate, region)) }
}
export async function measureSource(bytes: Uint8Array, region?: SourceRegion) {
  const image = sharp(bytes, { limitInputPixels: 100_000_000 }),
    metadata = region ? await image.metadata() : undefined
  const width = metadata?.width,
    height = metadata?.height
  const left = region ? Math.min(width! - 1, Math.floor(region.x * width!)) : 0,
    top = region ? Math.min(height! - 1, Math.floor(region.y * height!)) : 0
  if (region)
    image.extract({
      left,
      top,
      width: Math.max(1, Math.min(width! - left, Math.ceil(region.width * width! - 1e-8))),
      height: Math.max(1, Math.min(height! - top, Math.ceil(region.height * height! - 1e-8))),
    })
  const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const sourceWidth = width || info.width,
    sourceHeight = height || info.height
  const ink = neutralInk(data, info.width, info.height),
    pixels = ink.pixels
  const result = await analyzePlan(pixels, info.width, info.height)
  const point = (x: number, y: number) => ({
    x: Math.max(0, Math.min(1, (left + x) / sourceWidth)),
    y: Math.max(0, Math.min(1, (top + y) / sourceHeight)),
  })
  const base = {
    confidence: 0.65,
    evidence: 'Native-resolution OpenCV measurement; classify against the source before erection',
    uncertainties: [],
    needsReview: true as const,
  }
  const candidates: Candidate[] = result.candidates.map((line, index) => ({
    ...base,
    id: `cv_wall_${index}`,
    kind: 'wall',
    points: [point(line.x1, line.y1), point(line.x2, line.y2)],
    thickness: Math.min(0.1, line.thicknessPixels / sourceWidth),
  }))
  // Technical drawings often use single-pixel partitions that structural denoising removes.
  // Keep those precise strokes as evidence; only AI-confirmed measurements become walls.
  const fine = new Uint8Array(info.width * info.height)
  for (let pixel = 0; pixel < fine.length; pixel++) {
    const at = pixel * 4,
      alpha = pixels[at + 3] / 255
    fine[pixel] =
      (pixels[at] * 0.2126 + pixels[at + 1] * 0.7152 + pixels[at + 2] * 0.0722) * alpha + 255 * (1 - alpha) <
      200
        ? 1
        : 0
  }
  const edges = scanWallEdges(
    fine,
    info.width,
    info.height,
    Math.max(8, Math.min(info.width, info.height) * 0.012),
  )
    .filter((edge) => !coveredStroke(edge, result.candidates))
    .sort((a, b) => b.end - b.start - (a.end - a.start))
    .slice(0, 400)
  edges.forEach((edge, index) => {
    const points = edge.horizontal
      ? [point(edge.start, edge.fixed), point(edge.end, edge.fixed)]
      : [point(edge.fixed, edge.start), point(edge.fixed, edge.end)]
    candidates.push({
      ...base,
      id: `cv_edge_${index}`,
      kind: 'wall',
      points,
      thickness: Math.min(0.1, edge.stroke / sourceWidth),
      confidence: 0.45,
      evidence:
        'Native thin continuous stroke; classify partition, door/frame, furniture or annotation before erection',
    })
  })
  result.details.forEach((item, index) =>
    candidates.push({
      ...base,
      id: `cv_detail_${index}`,
      kind: item.kind,
      points: item.polygon.map((p) => point(p.x, p.z)),
      evidence: item.evidence,
      confidence: item.confidence,
    }),
  )
  // Cover the complete sheet, rather than taking the first noisy horizontal features.
  const cells = new Map<string, typeof result.features>()
  for (const feature of result.features) {
    const key = `${Math.floor(((feature.x1 + feature.x2) / 2 / info.width) * 8)}:${Math.floor(((feature.y1 + feature.y2) / 2 / info.height) * 8)}`
    const cell = cells.get(key) || []
    cell.push(feature)
    cells.set(key, cell)
  }
  let index = 0
  for (const cell of cells.values())
    for (const feature of cell
      .sort(
        (a, b) =>
          Number(b.kind === 'swing') - Number(a.kind === 'swing') ||
          Math.hypot(b.x2 - b.x1, b.y2 - b.y1) - Math.hypot(a.x2 - a.x1, a.y2 - a.y1),
      )
      .slice(0, 8)) {
      candidates.push({
        ...base,
        id: `cv_feature_${index++}`,
        kind: 'unknown',
        points: [point(feature.x1, feature.y1), point(feature.x2, feature.y2)],
        evidence: `Measured thin ${feature.kind} line; may be opening, court marking, furniture or annotation`,
      })
    }
  return {
    candidates: candidates.slice(0, 2000),
    complex: result.features.length > 600 || result.candidates.length > 100,
    report: {
      width: sourceWidth,
      height: sourceHeight,
      measuredWidth: info.width,
      measuredHeight: info.height,
      walls: result.candidates.length,
      fineEdges: edges.length,
      features: result.features.length,
      details: result.details.length,
      suppressedColourFillPixels: ink.suppressed,
    },
  }
}
export function classifiedMeasurements(
  measured: Candidate[],
  proposals: Intelligence[],
  dimensions?: { width: number; height: number },
) {
  const decisions = new Map(
    proposals.flatMap((item) => item.dispositions || []).map((item) => [item.candidateId, item.decision]),
  )
  const classified = new Set(proposals.flatMap((item) => item.candidates).map((item) => item.id))
  return respectMeasurementFootprint(
    measured
      .filter((item) => !item.id.startsWith('cv_edge_') || classified.has(item.id) || decisions.has(item.id))
      .filter(
        (item) => item.kind !== 'unknown' || classified.has(item.id) || decisions.get(item.id) === 'confirm',
      )
      .map((item) =>
        (item.kind === 'wall' || /^cv_detail_/.test(item.id)) &&
        decisions.get(item.id) !== 'confirm' &&
        !classified.has(item.id)
          ? {
              ...item,
              kind: 'unknown' as const,
              confidence: 0.35,
              uncertainties: ['Native measurement was not established as a building element'],
            }
          : decisions.get(item.id) === 'confirm'
            ? { ...item, confidence: Math.max(0.65, item.confidence) }
            : item,
      ),
    proposals,
    dimensions,
  )
}
