import type { MaterialKey } from '../domain/types'
// Editable construction defaults, never a claim about a finish in the raster.
export function roomFinish(label = ''): MaterialKey {
  if (/garage|workshop|plant|utility/i.test(label)) return 'polished-concrete'
  if (/bath|shower|toilet|kitchen|laundry|pantry/i.test(label)) return 'porcelain-tile'
  if (/living|dining|bed\s*room|closet|study|office|foyer/i.test(label)) return 'oak'
  return 'tile'
}
