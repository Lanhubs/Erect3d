import type { Point } from './types'
import type { articulationProfiles, architecturalSurfaces } from './articulation'
export type BuildingTypology =
  | 'house'
  | 'duplex'
  | 'villa'
  | 'apartment'
  | 'office'
  | 'office-tower'
  | 'hotel'
  | 'mixed-use'
  | 'mall'
  | 'school'
  | 'hospital'
  | 'public'
  | 'industrial'
  | 'stadium'
  | 'arena'
  | 'unknown'
type Base = {
  id: string
  name: string
  levelId: string
  origin: 'detected' | 'inferred' | 'design-proposal' | 'user-selected'
  evidence: string
  assumptions?: string[]
  visible?: boolean
  color: string
  elevation: number
}
export type EnclosureSystem = Base & {
  kind: 'core' | 'shaft'
  wallIds?: string[]
  polygon: Point[]
  height: number
  thickness: number
}
export type VoidSystem = Base & {
  kind: 'void'
  role: 'atrium' | 'courtyard' | 'shaft'
  polygon: Point[]
  height: number
}
export type BeamSystem = Base & { kind: 'beam'; start: Point; end: Point; width: number; height: number }
export type FacadeSystem = Base & {
  kind: 'curtain-wall'
  wallIds?: string[]
  path: Point[]
  height: number
  bayWidth: number
  transomHeight: number
  depth: number
  curve?: { center: Point; radius: number; startAngle: number; endAngle: number }
}
export type MassingSystem = Base & {
  kind: 'massing'
  role: 'podium' | 'tower' | 'wing' | 'crown' | 'mechanical'
  polygon: Point[]
  holes: Point[][]
  height: number
}
export type FloorLayoutEvidence = {
  matchesTemplate: true
  sourcePages: number[]
  levelNames: string[]
  reason: string
}
export type TypicalFloorGroup = Base & {
  kind: 'typical-floors'
  templateLevelId: string
  count: number
  floorHeight: number
  detached: Record<string, string>
  layoutEvidence?: FloorLayoutEvidence
}
export type SpiralStairSystem = Base & {
  kind: 'spiral-stair'
  center: Point
  radius: number
  width: number
  height: number
  riserHeight: number
  turnHeight: number
  rotation: number
  clockwise: boolean
  material: 'metal' | 'concrete'
  landings?: { levelId: string; angle: number }[]
}
export type ArticulationSystem = Base & {
  kind: 'articulation'
  repeatWithFloor?: boolean
  profile: (typeof articulationProfiles)[number]
  material: (typeof architecturalSurfaces)[number]
  path: Point[]
  footprint?: Point[]
  curve?: import('./types').WallCurve
  height: number
  depth: number
  thickness: number
  spacing: number
  side: 'left' | 'right'
}
export type BuildingSystem =
  | EnclosureSystem
  | VoidSystem
  | BeamSystem
  | FacadeSystem
  | MassingSystem
  | TypicalFloorGroup
  | ArticulationSystem
  | SpiralStairSystem
export type ArchitecturalModel = { version: 1; typology: BuildingTypology; systems: BuildingSystem[] }
