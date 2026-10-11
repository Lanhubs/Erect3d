import type { StairGuide } from './interpretationTypes'
import type { FurnitureObject } from '../furniture/types'
import type { WalkViewpoint } from '../walkthrough/types'
export type Point = { x: number; z: number }
export type MaterialKey = 'plaster' | 'concrete' | 'brick' | 'timber' | 'tile' | 'porcelain-tile' | 'laminate' | 'oak' | 'marble' | 'carpet' | 'polished-concrete'
export type WallCurve = { center: Point; radius: number; startAngle: number; endAngle: number }
export type Wall = { id: string; start: Point; end: Point; thickness: number; height: number; material: MaterialKey; color?: string; kind?: 'exterior' | 'interior' | 'partition'; curve?: WallCurve }
export type DoorStyle = 'flush' | 'panel' | 'glazed' | 'double'
export type Veranda = { width: number; depth: number; side: 'left' | 'right'; covered: boolean; railing: boolean; roofShape: 'shed' | 'terrace'; floorMaterial: FloorFinish }
export type Door = { id: string; wallId: string; offset: number; width: number; height: number; hinge: 'left' | 'right'; style?: DoorStyle; swing?: 'in' | 'out'; material?: 'timber' | 'metal'; veranda?: Veranda }
export type WindowUnit = { id: string; wallId: string; offset: number; width: number; height: number; sill: number;
  frame?: 'aluminium' | 'timber'; type?: 'fixed' | 'sliding' | 'casement'; glazing?: 'clear' | 'frosted' }
export type Passage = { id: string; wallId: string; offset: number; width: number; height: number }
export type Room = { id: string; name: string; polygon: Point[]; material: MaterialKey; ceilingHeight?: number; category?: string }
export type SlabMaterial = 'reinforced-concrete' | 'concrete' | 'timber' | 'steel-deck'
export type FloorFinish = 'concrete' | 'polished-concrete' | 'tile' | 'porcelain-tile' | 'marble' | 'timber' | 'laminate' | 'carpet'
export type SlabOpening = { id: string; polygon: Point[]; kind: 'stair' | 'shaft' | 'void' }
export type Slab = { id: string; polygon: Point[]; thickness: number; elevation: number;
  structuralMaterial: SlabMaterial; finishMaterial: FloorFinish; color?: string; textureScale?: number; openings: SlabOpening[]; autoFromWalls?: boolean }
export type Column = { id: string; position: Point; shape: 'rectangular' | 'circular'; width: number; depth: number;
  diameter: number; height: number; material: 'concrete' | 'steel' | 'timber'; rotation?: number }
export type Stair = { id: string; fromLevelId: string; toLevelId: string; start: Point; direction: number;
  form: 'straight' | 'L' | 'U'; width: number; riserHeight: number; treadDepth: number; landingLength: number;
  openingId?: string; guideId?: string }
export type Ramp = { id: string; start: Point; end: Point; width: number; thickness: number;
  startElevation: number; endElevation: number; material: SlabMaterial }
export type SeatingSection = { id: string; name: string; start: Point; end: Point; outward: Point; rows: number;
  seatsPerRow: number; rowDepth: number; rowRise: number; baseElevation: number; seatColor: string; aisle?: boolean }
export type ArchitecturalDetail = { id: string; name: string; kind: 'railing' | 'screen' | 'fin' | 'canopy' | 'parapet' | 'pergola' | 'arch';
  start: Point; end: Point; baseElevation: number; height: number; depth: number; spacing: number;
  material: 'concrete' | 'steel' | 'timber' | 'glass'; color?: string }
export type RoofShape = 'hidden' | 'gable' | 'hip' | 'shed' | 'mansard' | 'butterfly' | 'terrace' | 'cross-gable' | 'cross-hip'
export type RoofMaterial = 'concrete' | 'standing-seam' | 'corrugated' | 'concrete-tile' | 'long-span-metal'
  | 'stone-coated-metal' | 'clay-tile' | 'shingle' | 'membrane' | 'glass'
export type Roof = { shape: RoofShape; material: RoofMaterial; color: string; pitch: number; overhang: number;
  ridgeDirection?: 'auto' | 'x' | 'z'; fasciaDepth?: number; elevationOffset?: number }
export type RoofSection = { id: string; name: string; levelId: string; footprint: Point[]; voids?: Point[][]; topHeight?: number; followFootprint?: boolean;
  framingSpacing?: number; automatic?: boolean; roof: Roof }
export const defaultRoof: Roof = { shape: 'hip', material: 'standing-seam', color: '#5e6970', pitch: 24, overhang: .45 }
export type FenceMaterial = 'timber' | 'metal' | 'concrete' | 'brick'
export type SiteFenceGate = { id: string; kind: 'pedestrian' | 'vehicle'; segmentId: string; offset: number; width: number; height: number; material?: FenceMaterial; color?: string }
export type SiteFenceSegment = { id: string; start: Point; end: Point; height: number; thickness: number; material?: FenceMaterial; color?: string }
export type SiteFence = { id: string; name: string; height: number; thickness: number; material: FenceMaterial; segments: SiteFenceSegment[]; gates: SiteFenceGate[];
  enabled?: boolean; color?: string; boundary?: Point[]; mode?: 'automatic' | 'manual'; setbacks?: { front: number; rear: number; left: number; right: number } }
export type Level = { id: string; name: string; elevation: number; floorToFloorHeight?: number; visible?: boolean; locked?: boolean;
  walls: Wall[]; doors: Door[]; windows: WindowUnit[]; passages?: Passage[]; rooms: Room[]; slabThickness: number;
  slabs?: Slab[]; autoSlab?: boolean; columns?: Column[]; stairs?: Stair[]; ramps?: Ramp[]; seatingSections?: SeatingSection[];
  details?: ArchitecturalDetail[]; stairGuides?: StairGuide[]; furniture?: FurnitureObject[];
  sourceId?: string; calibration?: Calibration; alignment?: Point; roof?: Roof; autoRoof?: boolean }
export type Building = { id: string; name: string; levels: Level[]; roof?: Roof; roofSections?: RoofSection[]; siteFence?: SiteFence; walkViewpoints?: WalkViewpoint[] }
export type SourceDocument = { id: string; name: string; mime: string; originalBytes: number; width: number; height: number; page?: number; pages?: number }
export type Calibration = { a: Point; b: Point; knownMetres: number; metresPerPixel: number;
  method?: 'auto' | 'manual'; basisPixels?: number; basis?: 'door-symbols' | 'wall-thickness' }
export type Project = { id: string; name: string; modified: number; buildings: Building[]; sources: SourceDocument[]; calibration?: Calibration; units: 'm' | 'cm' | 'mm' }
export type EntityKind = 'wall' | 'door' | 'window' | 'passage' | 'room' | 'slab' | 'column' | 'stair' | 'ramp' | 'seating' | 'detail' | 'fence' | 'furniture'
export type Selection = { kind: EntityKind; id: string } | null
export const uid = (prefix: string) => `${prefix}_${crypto.randomUUID()}`
export const levelOf = (project: Project) => project.buildings[0].levels[0]
export const activeLevel = (project: Project, id: string | null) => project.buildings[0].levels.find(level => level.id === id) || levelOf(project)
