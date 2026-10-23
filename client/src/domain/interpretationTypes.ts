import type { Point } from './types'
export type PlanDetail = {
  id: string
  kind: 'column' | 'stair'
  polygon: Point[]
  confidence: number
  evidence: string
  treadCount?: number
}
export type StairGuide = { id: string; polygon: Point[]; treadCount?: number; evidence: string }
