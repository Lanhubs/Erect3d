export type Point = { x: number; z: number }
export type MaterialKey = 'plaster' | 'concrete' | 'brick' | 'timber' | 'tile' | 'oak' | 'marble' | 'carpet' | 'polished-concrete'
export type Wall = { id: string; start: Point; end: Point; thickness: number; height: number; material: MaterialKey; color?: string; kind?: 'exterior' | 'interior' | 'partition' }
export type DoorStyle = 'flush' | 'panel' | 'glazed' | 'double'
export type Door = { id: string; wallId: string; offset: number; width: number; height: number; hinge: 'left' | 'right'; style?: DoorStyle; swing?: 'in' | 'out'; material?: 'timber' | 'metal' }
export type WindowUnit = { id: string; wallId: string; offset: number; width: number; height: number; sill: number;
  frame?: 'aluminium' | 'timber'; type?: 'fixed' | 'sliding' | 'casement'; glazing?: 'clear' | 'frosted' }
export type Passage = { id: string; wallId: string; offset: number; width: number; height: number }
export type Room = { id: string; name: string; polygon: Point[]; material: MaterialKey; ceilingHeight?: number; category?: string }
export type RoofShape = 'hidden' | 'gable' | 'hip' | 'shed'
export type RoofMaterial = 'concrete' | 'standing-seam' | 'corrugated' | 'concrete-tile'
export type Roof = { shape: RoofShape; material: RoofMaterial; color: string; pitch: number; overhang: number }
export const defaultRoof: Roof = { shape: 'hip', material: 'standing-seam', color: '#5e6970', pitch: 24, overhang: .45 }
export type Level = { id: string; name: string; elevation: number; walls: Wall[]; doors: Door[]; windows: WindowUnit[]; passages?: Passage[]; rooms: Room[]; slabThickness: number; roof?: Roof }
export type Building = { id: string; name: string; levels: Level[] }
export type SourceDocument = { id: string; name: string; mime: string; originalBytes: number; width: number; height: number; page?: number; pages?: number }
export type Calibration = { a: Point; b: Point; knownMetres: number; metresPerPixel: number;
  method?: 'auto' | 'manual'; basisPixels?: number }
export type Project = { id: string; name: string; modified: number; buildings: Building[]; sources: SourceDocument[]; calibration?: Calibration; units: 'm' | 'cm' | 'mm' }
export type EntityKind = 'wall' | 'door' | 'window' | 'passage' | 'room'
export type Selection = { kind: EntityKind; id: string } | null
export const uid = (prefix: string) => `${prefix}_${crypto.randomUUID()}`
export const levelOf = (project: Project) => project.buildings[0].levels[0]
