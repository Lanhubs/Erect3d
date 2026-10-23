import type { PartBuilder } from './parts'
export function sanitaryParts({ object, add, parts }: PartBuilder) {
  const type = object.type,
    ceramic = '#f0eee7',
    chrome = '#aab5ba'
  if (type === 'toilet') {
    add(0, 0.2, 0.04, 0.52, 0.4, 0.5, ceramic, 'taper', 'ceramic')
    add(0, 0.38, 0.1, 0.98, 0.36, 0.69, ceramic, 'bowl', 'ceramic')
    add(0, 0.575, 0.1, 0.99, 0.035, 0.7, '#faf8f2', 'ring', 'plastic')
    add(0, 0.74, -0.34, 0.89, 0.5, 0.26, ceramic, 'soft-box', 'ceramic')
    add(0, 0.99, -0.34, 0.94, 0.035, 0.29, ceramic, 'soft-box', 'ceramic')
    add(0.22, 0.99, -0.3, 0.14, 0.02, 0.07, chrome, 'cylinder', 'metal')
  } else if (['sink', 'bathroom-sink', 'bathtub'].includes(type)) {
    const tub = type === 'bathtub'
    if (!tub) {
      add(0, 0.37, 0, 0.89, 0.7, 0.84, '#8c7760', 'soft-box', 'timber')
      for (const x of [-0.22, 0.22]) add(x, 0.38, 0.425, 0.41, 0.6, 0.025, '#9e896f', 'soft-box', 'timber')
      add(0, 0.75, 0, 1, 0.06, 1, '#dfdbd1', 'soft-box', 'stone')
    }
    add(0, tub ? 0.5 : 0.83, 0, tub ? 1 : 0.78, tub ? 0.94 : 0.35, tub ? 1 : 0.73, ceramic, 'bowl', 'ceramic')
    add(0, tub ? 0.12 : 0.68, 0, 0.12, 0.02, 0.12, chrome, 'cylinder', 'metal')
    add(0.3, 1.05, -0.32, 0.028, 0.22, 0.028, chrome, 'cylinder', 'metal')
    add(
      0.3,
      1.15,
      -0.23,
      0.028,
      (0.2 * object.depth) / object.height,
      (0.028 * object.width) / object.depth,
      chrome,
      'cylinder',
      'metal',
      [Math.PI / 2, 0, 0],
    )
    for (const x of [0.22, 0.38]) add(x, 1, -0.32, 0.045, 0.05, 0.045, chrome, 'cylinder', 'metal')
  } else if (type === 'shower') {
    add(0, 0.025, 0, 1, 0.05, 1, ceramic, 'soft-box', 'ceramic')
    add(-0.48, 0.51, 0, 0.015, 0.98, 0.99, '#b4d4d5', 'box', 'glass').opacity = 0.22
    add(0, 0.51, -0.48, 0.99, 0.98, 0.015, '#b4d4d5', 'box', 'glass').opacity = 0.22
    for (const x of [-0.48, 0.48]) add(x, 0.51, -0.48, 0.018, 0.98, 0.018, chrome, 'cylinder', 'metal')
    add(0.28, 0.56, -0.43, 0.022, 0.7, 0.022, chrome, 'cylinder', 'metal')
    add(0.28, 0.9, -0.33, 0.025, (0.25 * object.depth) / object.height, 0.025, chrome, 'cylinder', 'metal', [
      Math.PI / 2,
      0,
      0,
    ])
    add(0.28, 0.9, -0.2, 0.18, 0.018, 0.18, chrome, 'cylinder', 'metal')
    add(0.28, 0.5, -0.42, 0.12, 0.04, 0.025, chrome, 'soft-box', 'metal')
    add(0, 0.052, 0.28, 0.13, 0.007, 0.13, '#7b8586', 'cylinder', 'metal')
  } else return false
  for (const part of parts) if (part.finish === 'glass') part.opacity = 0.22
  return true
}
