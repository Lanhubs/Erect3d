import type { Candidate } from '../../../api/src/contracts/analysis'
export function constructionAssumptions(candidate: Candidate) {
  const fields: string[] = []
  if (candidate.kind === 'room') fields.push('material')
  if (
    ['wall', 'door', 'window', 'passage', 'column', 'furniture'].includes(candidate.kind) &&
    candidate.heightMetres === undefined
  )
    fields.push('height')
  if (candidate.kind === 'wall' && candidate.thickness === undefined) fields.push('thickness')
  if (candidate.kind === 'furniture') {
    if (candidate.furnitureRotation === undefined) fields.push('rotation')
    if (candidate.furnitureVariant === undefined) fields.push('assetId')
  }
  if (candidate.kind === 'window') {
    if (candidate.sillMetres === undefined) fields.push('sill')
    if (candidate.windowType === undefined) fields.push('type')
    for (const field of [
      'frameWidth',
      'frameDepth',
      'frameOffset',
      'mullions',
      'transoms',
      'sillProjection',
    ] as const)
      if (candidate.windowConstruction?.[field] === undefined) fields.push(field)
  }
  if (candidate.kind === 'door') {
    if (candidate.origin === 'inferred' && candidate.doorStyle === 'sectional') fields.push('style')
    if (!candidate.doorStyle) fields.push('style')
    if (!candidate.hinge) fields.push('hinge')
    if (!candidate.swing) fields.push('swing')
    if (candidate.doorStyle === 'double' && !candidate.doorLeafStyle) fields.push('leafStyle')
  }
  return fields
}
