import type { InstancePart } from '../rendering/EntityInstances'
export function doorLeafAssembly(style: 'flush' | 'panel' | 'glazed', width: number, height: number) {
  const body: InstancePart[] = [],
    glass: InstancePart[] = [],
    panel: InstancePart[] = []
  const add = (parts: InstancePart[], x: number, y: number, w: number, h: number, d: number, z = 0) =>
    parts.push({ center: [x, y, z], size: [w, h, d], rotation: 0 })
  if (style === 'glazed') {
    const stile = Math.min(0.075, width / 5),
      bottom = height * 0.28,
      top = 0.1
    for (const side of [-1, 1]) add(body, (side * (width - stile)) / 2, height / 2, stile, height, 0.045)
    add(body, 0, bottom / 2, width - 2 * stile, bottom, 0.045)
    add(body, 0, height - top / 2, width - 2 * stile, top, 0.045)
    add(glass, 0, (bottom + height - top) / 2, width - 2 * stile, height - top - bottom, 0.008)
  } else {
    add(body, 0, height / 2, width, height, 0.045)
    if (style === 'panel')
      for (const side of [-1, 1])
        for (const y of [0.3, 0.72])
          add(panel, 0, height * y, width * 0.74, height * 0.32, 0.008, side * 0.027)
  }
  return { body, glass, panel }
}
