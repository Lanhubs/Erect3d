import type { Point } from '../domain/types'
export const furnitureTypes = [
  'bed',
  'bedside-table',
  'sofa',
  'armchair',
  'coffee-table',
  'television-unit',
  'dining-table',
  'dining-chair',
  'wardrobe',
  'kitchen-cabinet',
  'kitchen-island',
  'refrigerator',
  'cooker',
  'sink',
  'washing-machine',
  'toilet',
  'bathroom-sink',
  'bathtub',
  'shower',
  'desk',
  'office-chair',
  'storage-cabinet',
  'unknown',
] as const
export type FurnitureType = (typeof furnitureTypes)[number]
export type FurnitureObject = {
  id: string
  type: FurnitureType
  levelId: string
  roomId?: string
  position: Point
  rotation: number
  width: number
  depth: number
  height: number
  assetId: string
  materialOverrides?: { color?: string; finish?: 'fabric' | 'timber' | 'metal' | 'ceramic' }
  sourceDetectionId?: string
}
export type FurnitureCandidate = FurnitureObject & {
  confidence: number
  sourceBounds: { x: number; y: number; width: number; height: number }
  status: 'uncertain' | 'accepted' | 'rejected'
  issues: string[]
}
export const furnitureLabel = (type: string) =>
  type.replaceAll('-', ' ').replace(/^./, (char) => char.toUpperCase())
