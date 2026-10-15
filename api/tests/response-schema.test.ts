import { expect,test } from 'bun:test'
import { responseSchema } from '../src/modules/ai/response-schema'
import { intelligenceSchema } from '../src/contracts/analysis'
import { classifyFailure } from '../src/modules/ai/provider'
test('provider generation schema keeps fixed coordinates and review markers but excludes unsupported and unnecessary grammar',()=>{
  const schema=responseSchema('structure') as any,encoded=JSON.stringify(schema)
  expect(schema.properties.coordinatesVersion.enum).toEqual([1])
  expect(schema.properties.candidates.items.properties.needsReview.enum).toEqual([true])
  expect(schema.properties.candidates.items.properties.action).toBeUndefined()
  expect(schema.properties.designs).toBeUndefined();expect(encoded).not.toContain('"const"');expect(encoded).not.toContain('"oneOf"')
  expect((responseSchema('architecture-completion') as any).properties.designs).toBeDefined()
  expect(intelligenceSchema.safeParse({ coordinatesVersion:1,coordinateSystem:'normalized-image-top-left',candidates:[],warnings:[],unexpected:true }).success).toBe(false)
})
test('safe provider failures distinguish credentials, unavailable models and rejected schemas without exposing upstream messages',()=>{
  const error=Object.assign(new Error('API key not valid: secret'),{ status:400 })
  expect(classifyFailure(error).code).toBe('AI_AUTH_FAILED');expect(classifyFailure(error).message).not.toContain('secret')
  expect(classifyFailure({ status:404 }).code).toBe('AI_MODEL_UNAVAILABLE')
  expect(classifyFailure(Object.assign(new Error('response schema invalid'),{ status:400 })).code).toBe('AI_SCHEMA_REJECTED')
})
