import type { Intelligence } from '../../contracts/analysis'
import { ProviderFailure } from './provider'
// Old project documents still deserialize. New interpretation never synthesizes
// the retired sports branch, including cached proposals and custom providers.
export function assertBuildingScope(proposal: Intelligence) {
  if (
    [proposal.understanding?.buildingType, proposal.architecturalRequirements?.typology].some(
      (type) => type === 'arena' || type === 'stadium',
    ) ||
    proposal.vision
  )
    throw new ProviderFailure('BUILDING_TYPE_UNSUPPORTED', false)
}
