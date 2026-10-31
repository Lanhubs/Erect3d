import type { CadFormat } from './signature'

export type CadUnit = 'mm' | 'cm' | 'm' | 'in' | 'ft' | 'unknown'
export type CadPoint = { x: number; y: number }
export type CadStroke = { points: CadPoint[]; closed: boolean }
export type CadLabel = { x: number; y: number; height: number; text: string }
export type CadBounds = { minX: number; minY: number; maxX: number; maxY: number }
export type CadScene = {
  strokes: CadStroke[]
  labels: CadLabel[]
  bounds: CadBounds
  entityCount: number
}
export type CadLimits = {
  maxBytes: number
  maxEntities: number
  timeoutMs: number
}
export type CadConversionResult = {
  format: CadFormat
  png: Uint8Array
  width: number
  height: number
  units: CadUnit
  metresPerPixel: number | null
  entityCount: number
  warnings: string[]
}
export type CadFailureCode =
  | 'DWG_CONVERT_FAILED'
  | 'DXF_PARSE_FAILED'
  | 'DXF_EMPTY'
  | 'DXF_TOO_COMPLEX'
  | 'DXF_TOO_LARGE'
  | 'RASTER_FAILED'
export class CadFailure extends Error {
  constructor(
    readonly code: CadFailureCode,
    message: string,
  ) {
    super(message)
    this.name = 'CadFailure'
  }
}
