export const articulationProfiles = [
  'canopy',
  'pergola',
  'fins',
  'colonnade',
  'balcony',
  'veranda',
  'cornice',
  'plinth',
  'parapet',
  'railing',
  'portal',
  'arch',
  'cladding',
] as const
export const architecturalSurfaces = [
  'render',
  'concrete',
  'brick',
  'stone',
  'timber',
  'metal',
  'glass',
] as const
export const originLabels = {
  detected: 'Source-derived',
  inferred: 'Inferred from context',
  'design-proposal': 'Design proposal',
  'user-selected': 'User selected',
} as const
