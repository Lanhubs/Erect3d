import type { ThinFeature } from './thinFeatures'

// Look for short fine strokes independently of the longer annotation-line budget.
export function stairTreads(mask: Uint8Array, width: number, height: number): ThinFeature[] {
  const lines: ThinFeature[] = [],
    maximum = Math.min(width, height) * 0.13
  for (const horizontal of [true, false]) {
    const count = horizontal ? height : width,
      span = horizontal ? width : height
    const pixel = (fixed: number, along: number) =>
      fixed >= 0 &&
      fixed < count &&
      along >= 0 &&
      along < span &&
      mask[horizontal ? fixed * width + along : along * width + fixed]
    for (let fixed = 0; fixed < count; fixed++) {
      let start = -1
      for (let along = 0; along <= span; along++) {
        if (pixel(fixed, along)) {
          if (start < 0) start = along
          continue
        }
        if (start < 0) continue
        const length = along - start,
          middle = Math.floor((start + along) / 2)
        if (length >= 8 && length <= maximum && !(pixel(fixed - 1, middle) && pixel(fixed + 1, middle))) {
          const prior = lines.at(-1)
          if (
            !prior ||
            (horizontal
              ? Math.abs(prior.y1 - fixed) > 1 || Math.abs(prior.x1 - start) > 2
              : Math.abs(prior.x1 - fixed) > 1 || Math.abs(prior.y1 - start) > 2)
          )
            lines.push({
              x1: horizontal ? start : fixed,
              y1: horizontal ? fixed : start,
              x2: horizontal ? along - 1 : fixed,
              y2: horizontal ? fixed : along - 1,
              kind: 'axis',
            })
        }
        start = -1
      }
    }
  }
  return lines
}
