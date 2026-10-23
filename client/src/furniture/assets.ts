import type { FurnitureObject } from './types'
import { partBuilder } from './parts'
import { upholsteredParts } from './upholsteredParts'
import { sanitaryParts } from './sanitaryParts'
import { caseworkParts } from './caseworkParts'
export type { FurniturePart } from './parts'
export function furnitureParts(object: FurnitureObject) {
  const builder = partBuilder(object)
  if (!upholsteredParts(builder) && !sanitaryParts(builder)) caseworkParts(builder)
  return builder.parts
}
