import { z } from 'zod'
import { color } from './primitives'
// This brief contains proposed architectural choices, not measured plan facts.
export const visionSchema = z
  .object({
    style: z.enum(['civic-modern', 'warm-modern', 'industrial']),
    roofCoverage: z.enum(['full', 'partial', 'open']),
    clearance: z.number().min(8).max(24),
    roofRise: z.number().min(1).max(12),
    concourseElevation: z.number().min(3).max(8),
    concourseWidth: z.number().min(3).max(12),
    seatingRows: z.number().int().min(4).max(24),
    towerCount: z.literal([0, 2, 4]),
    towerHeight: z.number().min(10).max(28),
    facadeColor: color,
    seatColor: color,
    rationale: z.string().min(1).max(1200),
    assumptions: z.array(z.string().max(500)).max(12),
  })
  .strict()
export type VisionBrief = z.infer<typeof visionSchema>
