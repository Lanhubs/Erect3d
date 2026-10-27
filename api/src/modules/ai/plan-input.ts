import type { IntelligenceInput } from './provider'
import { compactMeasurements, compactSourceFeatures } from './compact-reconstruction'
import { compactSourceText } from './compact-text'
export function planRequestContext(input: IntelligenceInput, direct: boolean, audit: boolean) {
  return {
    pass: input.pass,
    width: input.width,
    height: input.height,
    region: input.region,
    calibration: input.calibration,
    levelContext: input.levelContext,
    sourceText: compactSourceText(input.sourceText),
    labelReadings: input.labelReadings,
    understanding: input.understanding,
    purpose: input.purpose,
    currentModel: input.currentModel,
    validationIssues: input.validationIssues,
    architecturalRequirements: input.architecturalRequirements,
    engine: input.engine,
    selectedPdfPage: input.document?.page,
    designMode: input.designMode,
    sourceMeasurements: direct
      ? compactMeasurements(input.candidates)
      : input.candidates.filter((item) =>
          audit ? item.id.startsWith('cv_edge_') && item.confidence < 0.5 : item.id.startsWith('cv_'),
        ),
    sourceFeatures: direct ? compactSourceFeatures(input.candidates) : undefined,
    sourceSymbols: direct ? input.candidates.filter((item) => /^cv_detail_/.test(item.id)) : undefined,
    sourceWallReferenceCount: direct
      ? input.candidates.filter((item) => item.kind === 'wall').length
      : undefined,
    referenceGeometry: audit
      ? input.candidates.filter(
          (item) => (!item.id.startsWith('cv_edge_') || item.confidence >= 0.5) && item.kind !== 'unknown',
        )
      : undefined,
    priorAiCandidates: audit ? undefined : input.candidates.filter((item) => !item.id.startsWith('cv_')),
  }
}
