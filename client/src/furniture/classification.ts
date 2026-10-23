import type { FurnitureType } from './types'
import type { SymbolComponent } from './components'
export function classifySymbol(
  component: SymbolComponent,
  imageWidth: number,
  metresPerPixel: number,
  neighbours: SymbolComponent[],
) {
  const { width, height, x, y } = component,
    w = width * metresPerPixel,
    d = height * metresPerPixel
  const rows = new Float32Array(height),
    columns = new Float32Array(width)
  for (const pixel of component.pixels) {
    rows[Math.floor(pixel / imageWidth) - y]++
    columns[(pixel % imageWidth) - x]++
  }
  const maxBand = (profile: Float32Array, from: number, to: number) =>
    Math.max(0, ...profile.slice(Math.floor(profile.length * from), Math.ceil(profile.length * to)))
  const horizontal = maxBand(rows, 0, 0.12) > width * 0.65 && maxBand(rows, 0.88, 1) > width * 0.65
  const vertical = maxBand(columns, 0, 0.12) > height * 0.65 && maxBand(columns, 0.88, 1) > height * 0.65
  const rectangle = horizontal && vertical,
    ratio = Math.max(w, d) / Math.min(w, d),
    density = component.count / (width * height)
  let type: FurnitureType = 'unknown',
    confidence = 0.42,
    rotation = 0
  // Pillow band near one short end, with a clear mattress interior.
  if (
    rectangle &&
    ratio < 2.4 &&
    Math.min(w, d) >= 0.75 &&
    Math.min(w, d) <= 2.2 &&
    Math.max(w, d) >= 1.6 &&
    Math.max(w, d) <= 2.5
  ) {
    const profile = height >= width ? rows : columns,
      breadth = height >= width ? width : height
    const front = maxBand(profile, 0.12, 0.33),
      back = maxBand(profile, 0.67, 0.88),
      middle = maxBand(profile, 0.4, 0.6)
    if (
      Math.max(front, back) > breadth * 0.65 &&
      Math.min(front, back) < breadth * 0.55 &&
      middle < breadth * 0.5
    ) {
      type = 'bed'
      confidence = 0.84
      rotation = height >= width ? (front >= back ? 0 : 180) : front >= back ? 90 : -90
    }
  }
  if (
    type === 'unknown' &&
    rectangle &&
    Math.min(w, d) >= 0.55 &&
    Math.min(w, d) <= 1.15 &&
    Math.max(w, d) >= 1.45 &&
    Math.max(w, d) <= 3.1
  ) {
    const long = width >= height ? columns : rows,
      short = width >= height ? height : width
    if (
      maxBand(long, 0.25, 0.75) > short * 0.7 &&
      maxBand(width >= height ? rows : columns, 0.12, 0.35) > Math.max(width, height) * 0.65
    ) {
      type = 'sofa'
      confidence = 0.8
      rotation = width >= height ? 0 : 90
    }
  }
  const chairs = neighbours.filter(
    (other) =>
      other !== component &&
      Math.max(other.width, other.height) * metresPerPixel < 0.85 &&
      Math.hypot(other.x + other.width / 2 - x - width / 2, other.y + other.height / 2 - y - height / 2) *
        metresPerPixel <
        Math.max(w, d) / 2 + 0.8,
  )
  if (type === 'unknown' && rectangle && chairs.length >= 3 && Math.min(w, d) > 0.65 && Math.max(w, d) < 3) {
    type = 'dining-table'
    confidence = 0.83
    rotation = width >= height ? 0 : 90
  }
  // Nested tub outlines have four enclosing bands and elongated bathroom proportions.
  if (
    type === 'unknown' &&
    rectangle &&
    ratio > 1.65 &&
    Math.min(w, d) > 0.55 &&
    Math.min(w, d) < 0.95 &&
    Math.max(w, d) > 1.3 &&
    Math.max(w, d) < 2.1 &&
    maxBand(rows, 0.12, 0.25) > width * 0.6 &&
    maxBand(columns, 0.12, 0.25) > height * 0.6
  ) {
    type = 'bathtub'
    confidence = 0.76
    rotation = height >= width ? 0 : 90
  }
  // A tank band plus rounded bowl, rather than a generic rectangular appliance.
  if (
    type === 'unknown' &&
    !rectangle &&
    w >= 0.3 &&
    w <= 0.6 &&
    d >= 0.5 &&
    d <= 0.95 &&
    horizontal &&
    density < 0.5 &&
    maxBand(rows, 0.15, 0.3) > width * 0.75
  ) {
    type = 'toilet'
    confidence = 0.72
  }
  if (type === 'unknown' && rectangle && Math.min(w, d) > 0.4 && Math.max(w, d) < 0.95) {
    const rings = (component.children || []).filter(
      (c) => Math.abs(c.width / c.height - 1) < 0.2 && c.width < width * 0.4 && c.height < height * 0.4,
    )
    if (rings.length === 4) {
      type = 'cooker'
      confidence = 0.82
    } else if (
      component.children?.some(
        (c) =>
          c.width > width * 0.45 &&
          c.width < width * 0.85 &&
          c.height > height * 0.45 &&
          c.height < height * 0.85,
      )
    ) {
      type = 'sink'
      confidence = 0.65
    }
  }
  return { type, confidence, rotation }
}
