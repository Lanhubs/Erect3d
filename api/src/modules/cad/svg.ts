import type { CadPoint, CadScene, CadStroke } from './types'

export type RenderedSvg = { svg: string; width: number; height: number; pixelsPerUnit: number }

const padding = 24,
  minimumStroke = 1.6,
  maximumLabels = 4000,
  minimumLabelPixels = 7,
  fontStack = "'DejaVu Sans','Liberation Sans','Noto Sans',Arial,sans-serif"

const escape = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')

const round = (value: number) => Math.round(value * 100) / 100

function path(points: CadPoint[], closed: boolean): string {
  const head = `M${round(points[0].x)} ${round(points[0].y)}`,
    body = points
      .slice(1)
      .map((point) => `L${round(point.x)} ${round(point.y)}`)
      .join('')
  return `<path d="${head}${body}${closed ? 'Z' : ''}"/>`
}

/**
 * Projects the drawing into a white raster-sized page. DXF Y grows upwards, image Y grows
 * downwards, so the vertical axis is flipped while laying out.
 */
export function sceneToSvg(scene: CadScene, longSide = 3000): RenderedSvg {
  const extentX = Math.max(1e-6, scene.bounds.maxX - scene.bounds.minX),
    extentY = Math.max(1e-6, scene.bounds.maxY - scene.bounds.minY),
    longest = Math.max(extentX, extentY),
    interior = Math.max(16, longSide - padding * 2),
    pixelsPerUnit = interior / longest,
    width = Math.max(2, Math.round(extentX * pixelsPerUnit) + padding * 2),
    height = Math.max(2, Math.round(extentY * pixelsPerUnit) + padding * 2)
  const at = (point: CadPoint): CadPoint => ({
    x: padding + (point.x - scene.bounds.minX) * pixelsPerUnit,
    y: height - padding - (point.y - scene.bounds.minY) * pixelsPerUnit,
  })
  const strokes = scene.strokes
    .map((shape: CadStroke) => ({ ...shape, points: shape.points.map(at) }))
    .filter((shape) => shape.points.length > 1)
    .map((shape) => path(shape.points, shape.closed))
    .join('')
  const labels = scene.labels
    .map((label) => {
      const anchor = at({ x: label.x, y: label.y }),
        size = label.height * pixelsPerUnit
      return size < minimumLabelPixels
        ? null
        : `<text x="${round(anchor.x)}" y="${round(anchor.y)}" font-size="${round(size)}" font-family="${fontStack}" fill="black">${escape(label.text)}</text>`
    })
    .filter((text): text is string => Boolean(text))
    .slice(0, maximumLabels)
    .join('')
  return {
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="white"/><g stroke="black" stroke-width="${minimumStroke}" stroke-linejoin="round" stroke-linecap="round" fill="none">${strokes}</g><g>${labels}</g></svg>`,
    width,
    height,
    pixelsPerUnit,
  }
}
