import type { FurnitureObject } from './types'
export type FurniturePart = { shape: 'box' | 'soft-box' | 'cylinder' | 'sphere'; at: [number, number, number]; size: [number, number, number]; color: string; roughness: number; metalness: number; opacity?: number }
export function furnitureParts(object: FurnitureObject): FurniturePart[] {
  const parts: FurniturePart[] = [], w = object.width, d = object.depth, h = object.height
  const paint = object.materialOverrides?.color || '#b9aa91', finish = object.materialOverrides?.finish
  const add = (x: number, y: number, z: number, a: number, b: number, c: number, color = paint, shape: FurniturePart['shape'] = 'box') => parts.push({ shape,
    at: [x * w, y * h, z * d], size: [a * w, b * h, c * d], color, roughness: finish === 'ceramic' ? .22 : finish === 'metal' ? .38 : .82, metalness: finish === 'metal' ? .65 : 0 })
  const legs = (top = .8) => { for (const x of [-.4, .4]) for (const z of [-.38, .38]) add(x, top / 2, z, .045, top, .055, '#635548') }
  if (object.type === 'bed') {
    add(0, .25, 0, .97, .16, .95, '#806c57'); add(0, .46, .01, 1, .26, .94, '#ece8df', 'soft-box'); add(0, .72, -.48, 1, .55, .045, paint)
    add(0, .6, .18, .98, .045, .59, '#819994')
    for (const x of object.assetId === 'single' || w < 1.2 ? [0] : [-.23, .23]) add(x, .63, -.3, w < 1.2 ? .76 : .42, .12, .22, '#f9f5e9', 'soft-box')
    for (const x of [-.42, .42]) for (const z of [-.42, .42]) add(x, .1, z, .06, .2, .06, '#635548')
  } else if (['sofa', 'armchair', 'dining-chair', 'office-chair'].includes(object.type)) {
    const chair = object.type.endsWith('chair') && object.type !== 'armchair'
    legs(.45); add(0, .52, .04, .9, .2, .85, paint, 'soft-box'); add(0, .83, -.4, .93, .34, .14, paint, 'soft-box')
    if (!chair) { for (const x of [-.45, .45]) add(x, .62, 0, .1, .4, .9, paint, 'soft-box')
      const count = object.assetId === '2-seat' ? 2 : object.type === 'armchair' ? 1 : 3
      for (let i = 0; i < count; i++) add((i + .5) / count * .8 - .4, .65, .08, .78 / count, .13, .65, '#d1c4ad', 'soft-box')
      if (object.assetId === 'sectional') add(.3, .51, .3, .38, .24, .65) }
  } else if (['dining-table', 'coffee-table', 'desk', 'bedside-table', 'television-unit'].includes(object.type)) {
    legs(.9); add(0, .94, 0, 1, .12, 1, object.type === 'desk' ? '#b89a73' : paint)
    if (object.type === 'desk') add(.32, .6, 0, .25, .6, .86)
    if (['bedside-table', 'television-unit'].includes(object.type)) { add(0, .55, 0, .9, .65, .9); add(0, .55, .46, .85, .018, .02, '#766453') }
  } else if (object.type === 'toilet') {
    add(0, .22, .1, .62, .44, .65, '#f0efeb', 'sphere'); add(0, .46, .13, 1, .12, .66, '#f5f4ef', 'sphere')
    add(0, .49, .13, .62, .02, .4, '#7b9296', 'sphere'); add(0, .75, -.36, .93, .5, .25, '#e9e9e4'); add(.25, .91, -.2, .13, .035, .035, '#9aacae')
  } else if (['sink', 'bathroom-sink', 'bathtub'].includes(object.type)) {
    const tub = object.type === 'bathtub'
    add(0, .48, 0, 1, .95, 1, '#eeeee8'); add(0, .96, 0, .86, .045, .83, '#849b9e')
    for (const x of [-.46, .46]) add(x, .95, 0, .08, .1, 1, '#f5f3ec')
    for (const z of [-.46, .46]) add(0, .95, z, .88, .1, .08, '#f5f3ec')
    add(0, 1.06, -.36, .035, tub ? .16 : .24, .035, '#9caab1', 'cylinder'); add(0, 1.15, -.3, .035, .035, .18, '#9caab1')
  } else if (object.type === 'shower') {
    add(0, .03, 0, 1, .06, 1, '#e9ebe8'); add(-.47, .5, 0, .025, 1, 1, '#9ebabc'); add(0, .5, -.47, 1, 1, .025, '#a5bfc1')
    parts[parts.length - 1].opacity = .3; parts[parts.length - 2].opacity = .3
    for (const x of [-.48, .48]) add(x, .5, -.48, .03, 1, .03, '#8f9b9c')
  } else {
    add(0, .48, 0, .96, .94, .96, ['refrigerator', 'washing-machine', 'cooker'].includes(object.type) ? '#c5ccca' : paint)
    add(0, .97, 0, 1, .06, 1, object.type.includes('kitchen') ? '#d8d6cd' : '#ddd9d0')
    add(0, .5, .485, .015, .82, .018, '#827d70')
    for (const x of [-.08, .08]) add(x, .62, .5, .025, .13, .025, '#777c79')
    if (object.type === 'washing-machine') { add(0, .5, .5, .67, .62, .07, '#e3e5df', 'sphere'); add(0, .5, .53, .47, .44, .03, '#687b82', 'sphere') }
    if (object.type === 'cooker') for (const x of [-.24, .24]) for (const z of [-.24, .24]) add(x, 1.005, z, .3, .025, .3, '#434b4b', 'cylinder')
  }
  return parts
}
