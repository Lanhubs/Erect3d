import type { Point } from './types'

export type SourceUnits = 'mm' | 'cm' | 'm' | 'in' | 'ft' | 'unknown'
export type SourceDocument = {
  id: string
  name: string
  mime: string
  originalBytes: number
  width: number
  height: number
  page?: number
  pages?: number
  metresPerPixel?: number
  units?: SourceUnits
}
export type Calibration = {
  a: Point
  b: Point
  knownMetres: number
  metresPerPixel: number
  method?: 'auto' | 'manual'
  basisPixels?: number
  basis?: 'door-symbols' | 'wall-thickness'
}
