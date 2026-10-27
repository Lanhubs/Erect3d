import { intelligenceSchema } from '../../contracts/analysis'
import { ProviderFailure } from './provider'
import { assertBuildingScope } from './building-scope'
import { anchorRoomScale } from '../plan-analysis/room-scale'
import { canonicalLabelReadings } from './label-wire'
export function validatedPlanResult(value: unknown, width: number, height: number) {
  const candidate =
    value && typeof value === 'object' && 'labelReadings' in value
      ? { ...value, labelReadings: canonicalLabelReadings(value.labelReadings) }
      : value
  const result = intelligenceSchema.safeParse(candidate)
  if (!result.success)
    throw new ProviderFailure(
      'AI_SCHEMA_MISMATCH',
      false,
      undefined,
      result.error.issues.slice(0, 20).map((issue) => `${issue.path.join('.')}: ${issue.code}`),
    )
  assertBuildingScope(result.data)
  return anchorRoomScale(result.data, width, height)
}
