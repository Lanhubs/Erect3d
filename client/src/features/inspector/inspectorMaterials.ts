import { materialColor } from '../../rendering/materials'

const materials = Object.keys(materialColor)

export const wallMaterials = materials.filter(
  (item) => !['marble', 'carpet', 'polished-concrete'].includes(item),
)

export const floorMaterials = [
  'tile',
  'porcelain-tile',
  'oak',
  'timber',
  'laminate',
  'marble',
  'carpet',
  'polished-concrete',
  'concrete',
]
