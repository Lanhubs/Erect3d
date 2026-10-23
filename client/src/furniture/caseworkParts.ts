import type { PartBuilder } from './parts'
export function caseworkParts({ object, add, legs, paint }: PartBuilder) {
  const type = object.type,
    metal = '#9ba5a8',
    dark = '#30383b'
  if (['dining-table', 'coffee-table', 'desk'].includes(type)) {
    const round = ['round', 'oval'].includes(object.assetId)
    if (round) {
      add(0, 0.08, 0, 0.48, 0.12, 0.48, '#494b46', 'cylinder', 'metal')
      add(0, 0.5, 0, 0.13, 0.79, 0.13, '#71634f', 'taper', 'timber')
    } else {
      legs(0.9, '#6b563e', 'timber', 0.12)
      add(0, 0.82, 0, 0.84, 0.12, 0.76, '#7c674d', 'soft-box', 'timber')
    }
    add(0, 0.96, 0, 1, 0.08, 1, paint, round ? 'cylinder' : 'soft-box', 'timber')
    if (type === 'desk') {
      add(0.32, 0.49, 0, 0.25, 0.78, 0.84, '#b49a79', 'soft-box', 'timber')
      for (const y of [0.28, 0.51, 0.73]) add(0.32, y, 0.43, 0.15, 0.014, 0.025, metal, 'soft-box', 'metal')
    }
  } else {
    const appliance = ['refrigerator', 'washing-machine', 'cooker'].includes(type)
    const cabinet =
      type.includes('kitchen') ||
      type.includes('cabinet') ||
      type === 'wardrobe' ||
      type === 'television-unit' ||
      type === 'bedside-table'
    legs(0.09, dark, 'metal')
    add(
      0,
      0.5,
      0,
      0.96,
      0.88,
      0.94,
      appliance ? '#d0d2cf' : paint,
      'soft-box',
      appliance ? 'metal' : 'timber',
    )
    if (cabinet) {
      const count = Math.max(1, Math.min(4, Math.round(object.width / 0.55)))
      for (let i = 0; i < count; i++) {
        const x = ((i + 0.5) / count) * 0.93 - 0.465
        add(x, 0.51, 0.479, 0.9 / count, 0.79, 0.025, paint, 'soft-box', 'timber')
        add(x + 0.26 / count, 0.59, 0.502, 0.018, 0.11, 0.024, metal, 'cylinder', 'metal')
      }
      if (type.includes('kitchen')) add(0, 0.97, 0, 1, 0.06, 1, '#dfdcd2', 'soft-box', 'stone')
    } else if (type === 'washing-machine') {
      add(0, 0.84, 0.476, 0.9, 0.16, 0.024, '#e5e5df', 'soft-box', 'plastic')
      add(
        0.28,
        0.85,
        0.5,
        0.12,
        (0.035 * object.depth) / object.height,
        (0.085 * object.height) / object.depth,
        metal,
        'cylinder',
        'metal',
        [Math.PI / 2, 0, 0],
      )
      add(
        0,
        0.47,
        0.49,
        0.68,
        (0.08 * object.depth) / object.height,
        (0.68 * object.height) / object.depth,
        metal,
        'ring',
        'metal',
        [Math.PI / 2, 0, 0],
      )
      add(0, 0.47, 0.52, 0.49, 0.49, 0.025, '#324750', 'sphere', 'glass').opacity = 0.7
    } else if (type === 'cooker') {
      add(0, 0.96, 0, 0.94, 0.045, 0.92, dark, 'soft-box', 'metal')
      for (const x of [-0.24, 0.24])
        for (const z of [-0.24, 0.24]) add(x, 0.985, z, 0.29, 0.012, 0.29, '#707779', 'ring', 'metal')
      add(0, 0.45, 0.478, 0.78, 0.56, 0.02, dark, 'soft-box', 'glass')
      add(
        0,
        0.74,
        0.5,
        (0.025 * object.height) / object.width,
        (0.68 * object.width) / object.height,
        0.035,
        metal,
        'cylinder',
        'metal',
        [0, 0, Math.PI / 2],
      )
    } else if (type === 'refrigerator') {
      for (const y of [0.31, 0.75])
        add(0, y, 0.48, 0.92, y === 0.75 ? 0.38 : 0.48, 0.035, '#d6d8d5', 'soft-box', 'metal')
      for (const y of [0.37, 0.75]) add(0.35, y, 0.51, 0.028, 0.22, 0.035, metal, 'cylinder', 'metal')
    }
  }
}
