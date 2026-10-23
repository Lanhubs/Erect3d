import type { VisionBrief } from '../../../api/src/contracts/vision'
import type { Point } from './types'
export type ArchitectureVision = {
  id: string
  version: 1
  kind: 'arena'
  sourceLevelId: string
  courtId: string
  origin: 'inferred' | 'user-selected'
  brief: VisionBrief
  center: Point
  radiusX: number
  radiusZ: number
  rotation: number
  roofSectionId: string
  generatedIds: string[]
  generatedLevelIds: string[]
}
export const defaultArenaVision: VisionBrief = {
  style: 'civic-modern',
  roofCoverage: 'partial',
  clearance: 12,
  roofRise: 5.5,
  concourseElevation: 5.2,
  concourseWidth: 5,
  seatingRows: 12,
  towerCount: 4,
  towerHeight: 15,
  facadeColor: '#c5cbd0',
  seatColor: '#35515d',
  rationale:
    'A civic arena with a tiered bowl, raised public concourse, glazed circulation towers and a daylight canopy.',
  assumptions: [
    'Roof, seating, elevations, façade and towers are inferred design choices.',
    'Structural sizing, fire egress, accessibility and capacity require architectural review.',
  ],
}
