import type { Calibration, Wall } from '../domain/types'
import { uid } from '../domain/types'
import type { PlanDetail } from '../domain/interpretationTypes'
import type { PlanAnalysisResult } from '../workers/analyze'
import { estimateAutoScale, initialAutoScale } from './autoScale'
import { sourceToWorld } from './math'
import type { WorldFeature } from './openingCandidates'

export function worldInterpretation(
  result: PlanAnalysisResult,
  sourceSize: { width: number; height: number },
  manual?: Calibration,
) {
  const xScale = sourceSize.width / result.report.width,
    yScale = sourceSize.height / result.report.height
  const scaledLines = result.candidates.map((line) => ({
    x1: line.x1 * xScale,
    y1: line.y1 * yScale,
    x2: line.x2 * xScale,
    y2: line.y2 * yScale,
    thicknessPixels: line.thicknessPixels * Math.sqrt(xScale * yScale),
  }))
  const scaledFeatures = result.features.map((line) => ({
    ...line,
    x1: line.x1 * xScale,
    y1: line.y1 * yScale,
    x2: line.x2 * xScale,
    y2: line.y2 * yScale,
  }))
  const calibration =
    manual && manual.method !== 'auto'
      ? manual
      : scaledLines.length
        ? estimateAutoScale(scaledLines, sourceSize.width, sourceSize.height, scaledFeatures)
        : initialAutoScale(sourceSize.width, sourceSize.height)
  const point = (x: number, y: number) => sourceToWorld({ x, z: y }, calibration)
  const walls: Wall[] = scaledLines.map((line) => ({
    id: uid('wall'),
    start: point(line.x1, line.y1),
    end: point(line.x2, line.y2),
    thickness: Math.max(0.06, Math.min(1.2, line.thicknessPixels * calibration.metresPerPixel)),
    height: 2.9,
    material: 'plaster',
  }))
  const features: WorldFeature[] = scaledFeatures.map((line) => ({
    kind: line.kind,
    start: point(line.x1, line.y1),
    end: point(line.x2, line.y2),
  }))
  const details: PlanDetail[] = result.details.map((detail) => ({
    ...detail,
    id: uid('detected'),
    polygon: detail.polygon.map((vertex) => point(vertex.x * xScale, vertex.z * yScale)),
  }))
  return { walls, features, details, calibration, report: result.report }
}
