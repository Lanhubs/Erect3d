import { expect, test } from 'bun:test'
import { compactReconstructionSchema } from '../src/modules/ai/compact-reconstruction'
import { architecturalRequirements } from '../src/contracts/architectural-requirements'
import { normalizeArchitecturalWire } from '../src/modules/ai/architectural-wire'

test('provider grammar stays shallow while canonical spiral and detail dimensions remain mandatory', () => {
  const schema: any = compactReconstructionSchema(400)
  const wire = schema.properties.architecturalRequirements.properties.systems.items
  expect(wire.anyOf).toBeUndefined()
  expect(wire.oneOf).toBeUndefined()
  expect(wire.properties.kind.enum).not.toContain('spiral-stair')
  const spiral = schema.properties.architecturalRequirements.properties.spiralStairs.items
  expect(spiral.properties.parameters.required).toEqual([
    'height',
    'radius',
    'width',
    'riserHeight',
    'turnHeight',
  ])
  expect(wire.properties.parameters.required).toEqual(['height'])
  expect(wire.properties.layoutEvidence.properties.matchesTemplate).toEqual(
    expect.objectContaining({ type: 'boolean' }),
  )
  const system = {
    id: 'external-stair',
    name: 'Fire escape',
    kind: 'spiral-stair',
    boundaryId: 'source-outline',
    origin: 'detected',
    evidence: 'External circular stair',
    parameters: { height: 6.4 },
  }
  const value = { architecturalRequirements: { typology: 'office', systems: [system] } }
  expect(normalizeArchitecturalWire(value)).toBe(value)
  const { kind, ...stair } = system
  expect(
    normalizeArchitecturalWire({
      architecturalRequirements: { typology: 'office', systems: [], spiralStairs: [stair] },
    }),
  ).toEqual(value)
  expect(architecturalRequirements.safeParse(value.architecturalRequirements).success).toBe(false)
  system.parameters = Object.assign(system.parameters, {
    radius: 1.5,
    width: 1.1,
    riserHeight: 0.17,
    turnHeight: 3.2,
  })
  expect(architecturalRequirements.safeParse(value.architecturalRequirements).success).toBe(true)
  const detail = { ...system, kind: 'articulation', profile: 'canopy', parameters: { height: 3 } }
  expect(architecturalRequirements.safeParse({ typology: 'office', systems: [detail] }).success).toBe(false)
  const wireResponse = {
    architecturalRequirements: {
      typology: 'office',
      systems: [
        {
          id: 'canopy-1',
          name: 'Entrance Canopy',
          kind: 'articulation',
          boundaryId: 'source-outline',
          origin: 'inferred',
          evidence: 'Overhead canopy',
          parameters: { height: 2.8 },
        },
      ],
      spiralStairs: [],
    },
  }
  const normalized = normalizeArchitecturalWire(wireResponse)
  expect(architecturalRequirements.safeParse(normalized.architecturalRequirements).success).toBe(true)
  expect(normalized.architecturalRequirements.systems[0].profile).toBe('canopy')
  expect(normalized.architecturalRequirements.systems[0].parameters.depth).toBeGreaterThan(0)
  expect(normalized.architecturalRequirements.systems[0].parameters.thickness).toBeGreaterThan(0)
  expect(normalized.architecturalRequirements.systems[0].parameters.spacing).toBeGreaterThan(0)
})
