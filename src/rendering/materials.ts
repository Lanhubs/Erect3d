import type { MaterialKey } from '../domain/types'

export const materialColor: Record<MaterialKey, string> = {
  plaster: '#d9d6cd', concrete: '#a9aaa4', brick: '#a47763', timber: '#8c7154', tile: '#c8c4b8', oak: '#ac8962',
  marble: '#e1dfd9', carpet: '#9b9d91', 'polished-concrete': '#a9aaa7',
}
export const materialRoughness: Record<MaterialKey, number> = {
  plaster: .93, concrete: .92, brick: .94, timber: .72, tile: .42, oak: .68,
  marble: .24, carpet: 1, 'polished-concrete': .28,
}
