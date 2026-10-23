import type { PartBuilder } from './parts'
export function upholsteredParts({ object, paint, add, legs }: PartBuilder) {
  const type = object.type
  if (type === 'bed') {
    legs(0.2)
    add(0, 0.25, 0, 0.97, 0.16, 0.95, '#79644e', 'soft-box', 'timber')
    add(0, 0.44, 0.015, 0.95, 0.24, 0.91, '#ece8de', 'soft-box', 'fabric')
    add(0, 0.68, -0.46, 1, 0.62, 0.08, paint, 'soft-box', 'fabric')
    add(0, 0.58, 0.16, 0.97, 0.12, 0.61, '#6b8581', 'soft-box', 'fabric')
    add(0, 0.65, -0.08, 0.96, 0.07, 0.16, '#afbeb5', 'soft-box', 'fabric')
    for (const x of object.assetId === 'single' || object.width < 1.2 ? [0] : [-0.23, 0.23]) {
      add(x, 0.64, -0.3, object.width < 1.2 ? 0.76 : 0.42, 0.14, 0.22, '#f6f1e7', 'soft-box', 'fabric', [
        0.1,
        0,
        x * 0.12,
      ])
    }
    add(0, 0.65, 0.32, 0.98, 0.025, 0.18, '#c3b99d', 'soft-box', 'fabric')
    for (const x of [-0.48, 0.48]) add(x, 0.52, 0.22, 0.018, 0.18, 0.55, '#6b8581', 'soft-box', 'fabric')
  } else if (['sofa', 'armchair'].includes(type)) {
    legs(0.18, '#34312d', 'metal')
    add(0, 0.28, 0, 0.94, 0.2, 0.88, paint, 'soft-box', 'fabric')
    add(0, 0.7, -0.38, 0.95, 0.53, 0.2, paint, 'soft-box', 'fabric', [-0.12, 0, 0])
    for (const x of [-0.45, 0.45]) add(x, 0.51, 0.01, 0.12, 0.48, 0.91, paint, 'soft-box', 'fabric')
    const count = type === 'armchair' ? 1 : object.assetId === '2-seat' ? 2 : 3
    for (let i = 0; i < count; i++) {
      const x = ((i + 0.5) / count) * 0.76 - 0.38
      add(x, 0.46, 0.07, 0.73 / count, 0.2, 0.69, '#d3c9b7', 'soft-box', 'fabric')
      add(x, 0.74, -0.23, 0.73 / count, 0.38, 0.15, '#d3c9b7', 'soft-box', 'fabric', [-0.16, 0, 0])
    }
    if (type === 'sofa')
      for (const x of [-0.3, 0.3])
        add(x, 0.68, -0.12, 0.16, 0.24, 0.2, '#758d87', 'soft-box', 'fabric', [0.13, 0, x * 0.4])
    if (object.assetId === 'sectional')
      add(0.29, 0.46, 0.32, 0.29, 0.2, 0.35, '#d3c9b7', 'soft-box', 'fabric')
  } else if (type === 'dining-chair' || type === 'office-chair') {
    if (type === 'office-chair') {
      add(0, 0.22, 0, 0.07, 0.36, 0.07, '#6b7275', 'cylinder', 'metal')
      for (let i = 0; i < 5; i++) {
        const angle = (i * Math.PI * 2) / 5
        add(
          Math.sin(angle) * 0.2,
          0.08,
          Math.cos(angle) * 0.2,
          0.05,
          0.05,
          0.43,
          '#4c5558',
          'soft-box',
          'metal',
          [0, angle, 0],
        )
      }
    } else legs(0.48, '#705b43', 'timber', 0.25)
    add(0, 0.52, 0.015, 0.86, 0.12, 0.84, paint, 'soft-box', 'fabric')
    add(0, 0.81, -0.32, 0.91, 0.38, 0.32, '#74634e', 'chair-back', 'timber')
    add(0, 0.81, -0.27, 0.77, 0.27, 0.13, paint, 'soft-box', 'fabric', [-0.12, 0, 0])
  } else return false
  return true
}
