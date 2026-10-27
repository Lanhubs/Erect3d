import { z } from 'zod'
import { intelligenceSchema } from '../../contracts/analysis'
import { furnitureTypes } from '../../../../client/src/furniture/types'
import { architecturalWireSchema } from './architectural-wire'
import { labelReadingGeneration } from './label-wire'
// Keep the generation grammar small; the full strict contract validates every response.
export function responseSchema(
  pass: string,
  measurementIds?: string[],
  withText = false,
): Record<string, unknown> {
  const schema = z.toJSONSchema(intelligenceSchema) as any
  if (withText && pass === 'validated-model-repair') schema.required.push('labelReadings')
  delete schema.properties.vision
  delete schema.properties.sourceText
  // Removal operations are synthesized by the server from reviewed rejection evidence.
  delete schema.properties.candidates.items.properties.action
  schema.properties.candidates.items.properties.furnitureType = { type: 'string', enum: [...furnitureTypes] }
  if (pass !== 'architecture-completion') delete schema.properties.designs
  if (pass === 'validated-model-repair')
    schema.required = [...new Set([...schema.required, 'architecturalRequirements'])]
  if (
    ['global-understanding', 'consistency', 'architecture-completion', 'native-measurement-audit'].includes(
      pass,
    )
  ) {
    schema.properties.candidates = {
      type: 'array',
      items: { type: 'object', properties: {}, additionalProperties: false },
    }
    if (pass === 'architecture-completion') {
      delete schema.properties.understanding
      delete schema.properties.dispositions
    }
  }
  if (pass === 'native-measurement-audit') {
    schema.required = [...new Set([...schema.required, 'dispositions'])]
    if (measurementIds?.length)
      schema.properties.dispositions.items.properties.candidateId = { type: 'string', enum: measurementIds }
    delete schema.properties.understanding
  }
  const compact = (value: any): any => {
    if (Array.isArray(value)) return value.map(compact)
    if (!value || typeof value !== 'object') return value
    const result: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(value)) {
      if (['$schema', 'minLength', 'maxLength', 'minItems', 'maxItems', 'pattern', 'default'].includes(key))
        continue
      if (key === 'const') {
        result.enum = [item]
        continue
      }
      result[key === 'oneOf' ? 'anyOf' : key] = compact(item)
    }
    return result
  }
  const result = compact(schema)
  result.properties.labelReadings = labelReadingGeneration
  result.properties.architecturalRequirements = architecturalWireSchema(
    result.properties.architecturalRequirements,
  )
  return result
}
