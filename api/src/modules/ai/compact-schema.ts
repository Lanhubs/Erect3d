import { architecturalWireSchema } from './architectural-wire'
// Gemini accepts homogeneous numeric arrays; full tuple lengths are checked locally.
export function compactGenerationSchema(
  schema: Record<string, unknown>,
  withText = false,
): Record<string, unknown> {
  const simplify = (value: any): any => {
    if (Array.isArray(value)) return value.map(simplify)
    if (!value || typeof value !== 'object') return value
    if (value.prefixItems) return { type: 'array', items: { type: 'number', minimum: 0, maximum: 1 } }
    return Object.fromEntries(
      Object.entries(value)
        .filter(
          ([key]) =>
            !['$schema', 'minLength', 'maxLength', 'minItems', 'maxItems', 'pattern', 'default'].includes(
              key,
            ),
        )
        .map(([key, item]) => [
          key === 'const' ? 'enum' : key === 'oneOf' ? 'anyOf' : key,
          key === 'const' ? [item] : simplify(item),
        ]),
    )
  }
  const result = simplify(schema)
  result.properties.architecturalRequirements = architecturalWireSchema(
    result.properties.architecturalRequirements,
  )
  // New requests must establish an annotated or explicitly inferred reference.
  // The parser still accepts historical cached responses without this field.
  result.required = [
    ...new Set([...result.required, 'scale', 'architecturalRequirements', 'boundaries', 'windows']),
  ]
  result.properties.openings.items.properties.kind.enum = ['door', 'passage']
  delete result.properties.vision
  delete result.properties.strokeLabels
  result.required = [
    ...new Set([
      ...result.required.filter((key: string) => key !== 'strokeLabels'),
      'classification',
      'wallRefs',
      'uncertainWallRefs',
    ]),
  ]
  result.properties.wallRefs.description =
    'Every native measurement confirmed as a building wall. Other measurements are non-walls unless listed in uncertainWallRefs. Use exact numeric refs, never candidate IDs; use [] with zero measurements.'
  if (withText) result.required.push('labelReadings')
  return result
}
