import { z } from 'zod'
import { id, name, point } from '../../contracts/primitives'
import { furniture } from '../../contracts/project'
import { column, detail } from '../../contracts/elements'
import { roof, roofSection } from '../../contracts/roof-site'
import { floorDesign } from './design-floor'

export const buildingDesign = z
  .object({
    name,
    style: z.string().min(1).max(500),
    roof,
    floors: z
      .array(
        z
          .object({
            ref: id,
            name,
            height: z.number().min(2.4).max(20),
            layout: floorDesign.omit({ levelId: true }),
            furniture: z
              .array(
                furniture
                  .omit({ id: true, levelId: true, roomId: true, sourceDetectionId: true })
                  .extend({ roomName: name }),
              )
              .max(1000),
            columns: z
              .array(column.omit({ id: true }))
              .max(1000)
              .optional(),
            details: z
              .array(detail.omit({ id: true }))
              .max(1000)
              .optional(),
            roofs: z
              .array(roofSection.omit({ id: true, levelId: true }))
              .max(100)
              .optional(),
          })
          .strict(),
      )
      .min(1)
      .max(1000),
    stairs: z
      .array(
        z
          .object({
            fromRef: id,
            toRef: id,
            start: point.optional(),
            width: z.number().min(0.8).max(5),
            form: z.enum(['straight', 'L', 'U']),
          })
          .strict(),
      )
      .max(1000),
  })
  .strict()
export type BuildingDesign = z.infer<typeof buildingDesign>
