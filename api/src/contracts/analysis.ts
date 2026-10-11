import { z } from 'zod'
import { calibration, id, point } from './primitives'
const fraction = z.number().min(0).max(1)
export const imagePoint = z.object({ x: fraction, y: fraction }).strict()
export const regionSchema = z.object({ x: fraction, y: fraction, width: z.number().positive().max(1),
  height: z.number().positive().max(1) }).strict().refine(value => value.x + value.width <= 1 && value.y + value.height <= 1, 'Region must fit the image')
export const analysisOptions = z.object({
  mode: z.enum(['structure', 'rooms', 'fixtures', 'furniture', 'full']).default('structure'),
  complex: z.boolean().default(false), region: regionSchema.optional(),
  cloudConsent: z.literal(true),
}).strict()
export const candidateSchema = z.object({
  id, kind: z.enum(['wall', 'door', 'window', 'room', 'column', 'stair', 'furniture', 'void', 'unknown']),
  points: z.array(imagePoint).min(1).max(1024),
  curve: z.object({ center: imagePoint, radius: z.number().positive().max(2),
    startAngle: z.number().finite(), endAngle: z.number().finite() }).strict().optional(),
  wallId: id.optional(), label: z.string().max(200).optional(),
  thickness: z.number().positive().max(.1).optional(), heightMetres: z.number().positive().max(100).optional(),
  furnitureType: z.string().max(80).optional(),
  confidence: fraction, evidence: z.string().min(1).max(2000), uncertainties: z.array(z.string().max(500)).max(20),
  needsReview: z.literal(true),
}).strict()
export const intelligenceSchema = z.object({
  coordinatesVersion: z.literal(1), coordinateSystem: z.literal('normalized-image-top-left'),
  candidates: z.array(candidateSchema).max(2000), warnings: z.array(z.string().max(1000)).max(100),
}).strict()
export const analysisRequest = z.object({
  sourceAssetId: id, sourceId: id, levelId: id, page: z.number().int().positive().optional(),
  calibration, alignment: point.optional(),
  options: analysisOptions, deterministicCandidates: z.array(candidateSchema).max(2000).default([]),
}).strict()
export type Candidate = z.infer<typeof candidateSchema>
export type Intelligence = z.infer<typeof intelligenceSchema>
export type AnalysisInput = z.infer<typeof analysisRequest>
