import type { CadEntity, CadPoint } from './types'

/** Six decimals is millimetre truth on a metres-based sheet and never writes exponent form. */
export const num = (value: number) => {
  if (!Number.isFinite(value)) return '0'
  const rounded = Math.round(value * 1e6) / 1e6
  return Object.is(rounded, -0) ? '0' : String(rounded)
}

/** DXF pair tags put the code and its value on their own lines, and text cannot hold a newline. */
export const pair = (code: number, value: string | number) =>
  `${code}\r\n${typeof value === 'number' ? num(value) : value}\r\n`

/** Control characters and percent escapes would be read as AutoCAD formatting codes. */
export const textValue = (value: string) =>
  value
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/%%/g, '% ')
    .trim()

const xyz = (code: number, point: CadPoint) =>
  pair(code, point.x) + pair(code + 10, point.y) + pair(code + 20, point.z || 0)

const polyline = (points: CadPoint[], closed: boolean) => {
  const z = points.find((point) => point.z)?.z || 0
  return (
    pair(90, points.length) +
    pair(70, closed ? 1 : 0) +
    pair(43, 0) +
    (z ? pair(38, z) : '') +
    pair(39, 0) +
    points.map((point) => pair(10, point.x) + pair(20, point.y)).join('')
  )
}

const kindNames: Record<CadEntity['kind'], [string, string]> = {
  line: ['LINE', 'AcDbLine'],
  polyline: ['LWPOLYLINE', 'AcDbPolyline'],
  circle: ['CIRCLE', 'AcDbCircle'],
  arc: ['ARC', 'AcDbCircle'],
  text: ['TEXT', 'AcDbText'],
}

/** One entity, from its owner handle to its last coordinate, in the order strict readers expect. */
export function entityDxf(entity: CadEntity, handle: string): string {
  const [type, subclass] = kindNames[entity.kind]
  const head =
    pair(0, type) + pair(5, handle) + pair(100, 'AcDbEntity') + pair(8, entity.layer) + pair(100, subclass)
  switch (entity.kind) {
    case 'line':
      return head + xyz(10, entity.a) + xyz(11, entity.b)
    case 'polyline':
      return head + polyline(entity.points, entity.closed)
    case 'circle':
      return head + xyz(10, entity.center) + pair(40, entity.radius)
    case 'arc':
      return (
        head + xyz(10, entity.center) + pair(40, entity.radius) + pair(50, entity.from) + pair(51, entity.to)
      )
    case 'text':
      return (
        head +
        xyz(10, entity.at) +
        pair(40, entity.height) +
        pair(1, textValue(entity.value)) +
        pair(7, 'Standard')
      )
  }
}
