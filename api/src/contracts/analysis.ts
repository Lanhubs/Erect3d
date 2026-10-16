import {architecturalRequirements} from './architectural-requirements'
import {typology} from './architecture'
import {windowConstructionSchema} from './opening-construction'
import { z } from 'zod'
import { calibration, id, point } from './primitives'
import { designSchema } from './design'
import {visionSchema} from './vision'
const fraction = z.number().min(0).max(1)
export const imagePoint = z.object({ x: fraction, y: fraction }).strict()
export const regionSchema = z.object({ x: fraction, y: fraction, width: z.number().positive().max(1),
  height: z.number().positive().max(1) }).strict().refine(value => value.x + value.width <= 1 && value.y + value.height <= 1, 'Region must fit the image')
export const analysisOptions = z.object({
  mode: z.enum(['structure', 'rooms', 'fixtures', 'furniture', 'full']).default('structure'),
  complex: z.boolean().default(false), region: regionSchema.optional(),
  purpose: z.enum(['interpret', 'enhance', 'rebuild']).optional(), architectureCompletion: z.boolean().optional(),
  engine: z.enum(['backend', 'hybrid']).optional(),
  strategy: z.enum(['direct','detailed']).optional(),
  designMode:z.enum(['faithful','creative']).optional(),
  styleReferenceAssetId:id.optional(),
  cloudConsent: z.literal(true),
}).strict()
export const candidateSchema = z.object({
  id, kind: z.enum(['wall', 'door', 'window', 'passage', 'room', 'column', 'stair', 'furniture', 'void', 'architectural-boundary', 'unknown']),
  points: z.array(imagePoint).min(1).max(1024),
  curve: z.object({ center: imagePoint, radius: z.number().positive().max(2),
    startAngle: z.number().finite(), endAngle: z.number().finite() }).strict().optional(),
  wallId: id.optional(), label: z.string().max(200).optional(),
  roomCategory:z.enum(['basketball-court','football-pitch','table-tennis-hall']).optional(),
  targetId: id.optional(), confirmedFields: z.array(id).max(100).optional(),
  action: z.literal('remove').optional(),
  thickness: z.number().positive().max(.1).optional(), heightMetres: z.number().positive().max(100).optional(),
  furnitureType: z.string().max(80).optional(),
  doorStyle: z.enum(['flush', 'panel', 'glazed', 'double']).optional(), hinge: z.enum(['left', 'right']).optional(),
  swing: z.enum(['in', 'out']).optional(), columnShape: z.enum(['rectangular', 'circular']).optional(),
  wallKind: z.enum(['exterior','interior','partition']).optional(), sillMetres: z.number().nonnegative().max(20).optional(),
  windowType: z.enum(['fixed','casement','sliding']).optional(),windowConstruction:windowConstructionSchema.optional(),doorLeafStyle:z.enum(['flush','panel','glazed']).optional(),
  targetLevelId: id.optional(), stairForm: z.enum(['straight', 'L', 'U']).optional(), reverse: z.boolean().optional(),
  confidence: fraction, evidence: z.string().min(1).max(2000), uncertainties: z.array(z.string().max(500)).max(20),
  needsReview: z.literal(true),
}).strict()
export const intelligenceSchema = z.object({
  architecturalRequirements:architecturalRequirements.optional(),
  coordinatesVersion: z.literal(1), coordinateSystem: z.literal('normalized-image-top-left'),
  candidates: z.array(candidateSchema).max(2000), warnings: z.array(z.string().max(1000)).max(100),
  vision:visionSchema.optional(),
  understanding: z.object({
    buildingType: typology,
    footprint: z.array(imagePoint).max(1024),
    conventions: z.array(z.string().max(500)).max(20),
    circulation: z.array(z.string().max(500)).max(20),
    uncertainties: z.array(z.string().max(500)).max(20),
    scale: z.object({ a:imagePoint,b:imagePoint,knownMetres:z.number().positive().max(10000),
      origin:z.enum(['annotated','inferred']),evidence:z.string().min(1).max(1000) }).strict().optional(),
  }).strict().optional(),
  dispositions: z.array(z.object({ candidateId: id, decision: z.enum(['confirm','reject','defer']),
    reason: z.string().min(1).max(1000) }).strict()).max(2000).optional(),
  designs: z.array(designSchema).max(20).optional(),
}).strict()
export const analysisRequest = z.object({
  sourceAssetId: id, sourceId: id, levelId: id, page: z.number().int().positive().optional(),
  calibration, alignment: point.optional(),
  options: analysisOptions, deterministicCandidates: z.array(candidateSchema).max(2000).default([]),
}).strict()
export type Candidate = z.infer<typeof candidateSchema>
export type Intelligence = z.infer<typeof intelligenceSchema>
export type AnalysisInput = z.infer<typeof analysisRequest>
export const analysisJob = analysisRequest.extend({ context: z.object({ revision: z.number().int().nonnegative(),
  candidates: z.array(candidateSchema).max(2000), hashes: z.record(id, z.string().max(128)) }).strict().optional(),
  document:z.object({assetId:id,sha256:z.string().length(64),page:z.number().int().positive()}).strict().optional() })
export type AnalysisJob = z.infer<typeof analysisJob>
