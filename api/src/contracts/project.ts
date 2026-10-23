import { architecturalModelSchema } from './architecture'
import { z } from 'zod'
import type { Project } from '../../../client/src/domain/types'
import { furnitureTypes } from '../../../client/src/furniture/types'
import { calibration, color, id, name, point, positive, scalar, source } from './primitives'
import {
  column,
  detail,
  door,
  passage,
  ramp,
  room,
  seating,
  slab,
  stair,
  stairGuide,
  wall,
  windowUnit,
} from './elements'
import { fence, roof, roofSection } from './roof-site'
import { visionSchema } from './vision'
export type { Project, Building, Level, Point } from '../../../client/src/domain/types'

export const furniture = z
  .object({
    id,
    type: z.enum(furnitureTypes),
    levelId: id,
    roomId: id.optional(),
    position: point,
    rotation: scalar,
    width: positive,
    depth: positive,
    height: positive,
    assetId: id,
    materialOverrides: z
      .object({
        color: color.optional(),
        finish: z.enum(['fabric', 'timber', 'metal', 'ceramic']).optional(),
      })
      .strict()
      .optional(),
    sourceDetectionId: id.optional(),
  })
  .strict()
export const viewpoint = z
  .object({ id, name, levelId: id, point, foot: scalar, yaw: scalar, pitch: scalar })
  .strict()
const many = <T extends z.ZodType>(schema: T) => z.array(schema).max(20_000)
export const level = z
  .object({
    id,
    name,
    elevation: scalar,
    floorToFloorHeight: positive.optional(),
    visible: z.boolean().optional(),
    locked: z.boolean().optional(),
    walls: many(wall),
    doors: many(door),
    windows: many(windowUnit),
    passages: many(passage).optional(),
    rooms: many(room),
    slabThickness: positive,
    slabs: many(slab).optional(),
    autoSlab: z.boolean().optional(),
    columns: many(column).optional(),
    stairs: many(stair).optional(),
    ramps: many(ramp).optional(),
    seatingSections: many(seating).optional(),
    details: many(detail).optional(),
    stairGuides: many(stairGuide).optional(),
    furniture: many(furniture).optional(),
    sourceId: id.optional(),
    calibration: calibration.optional(),
    alignment: point.optional(),
    roof: roof.optional(),
    autoRoof: z.boolean().optional(),
  })
  .strict()
export const building = z
  .object({
    systems: architecturalModelSchema.optional(),
    id,
    name,
    levels: z.array(level).min(1).max(1000),
    roof: roof.optional(),
    roofSections: many(roofSection).optional(),
    siteFence: fence.optional(),
    walkViewpoints: many(viewpoint).optional(),
    designReference: z.object({ assetId: id, name }).strict().optional(),
    architecture: z
      .object({
        id,
        version: z.literal(1),
        kind: z.literal('arena'),
        sourceLevelId: id,
        courtId: id,
        origin: z.enum(['inferred', 'user-selected']),
        brief: visionSchema,
        center: point,
        radiusX: positive,
        radiusZ: positive,
        rotation: scalar,
        roofSectionId: id,
        generatedIds: z.array(id).max(20000),
        generatedLevelIds: z.array(id).max(20),
      })
      .strict()
      .optional(),
  })
  .strict()
export const projectSchema: z.ZodType<Project> = z
  .object({
    id,
    name,
    modified: z.number().finite().nonnegative(),
    buildings: z.array(building).min(1).max(1000),
    sources: z.array(source).max(1000),
    calibration: calibration.optional(),
    units: z.enum(['m', 'cm', 'mm']),
    interpretation: z
      .record(
        id,
        z
          .object({
            origin: z.enum(['detected', 'inferred', 'user-selected']),
            confirmedFields: z.array(id).max(100),
            sourceId: id.optional(),
            analysisId: id.optional(),
            candidateId: id.optional(),
            inferredFields: z.array(id).max(100).optional(),
            evidence: z.string().max(2000).optional(),
            assumptions: z.array(z.string().max(500)).max(20).optional(),
          })
          .strict(),
      )
      .optional(),
  })
  .strict()
export const documentSchemaVersion = 1
