import type { MaterialKey } from '../domain/types'

export const materialColor: Record<MaterialKey, string> = {
  plaster: '#d9d6cd', concrete: '#a9aaa4', brick: '#a47763', timber: '#8c7154', tile: '#c8c4b8', oak: '#ac8962',
  marble: '#e1dfd9', carpet: '#9b9d91', 'polished-concrete': '#a9aaa7', 'porcelain-tile': '#dedbd4', laminate: '#b29b78',
}
export const materialRoughness: Record<MaterialKey, number> = {
  plaster: .93, concrete: .92, brick: .94, timber: .72, tile: .42, oak: .68,
  marble: .24, carpet: 1, 'polished-concrete': .28, 'porcelain-tile': .22, laminate: .5,
}

export const façadePalette = {
  plaster: '#d9d6cd', concrete: '#b7b6af', brick: '#a67862', timber: '#8c7154', tile: '#c5c8b8', oak: '#a98a60',
  marble: '#e8e6e1', carpet: '#9fa29d', 'polished-concrete': '#a8a39e', 'porcelain-tile': '#e2e0dc', laminate: '#b8a17d',
}
