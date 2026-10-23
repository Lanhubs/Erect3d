import { z } from 'zod'
import type { Context } from 'hono'
import { ApiError } from '../security/errors'
import { id } from './primitives'
export async function body<T>(context: Context, schema: z.ZodType<T>): Promise<T> {
  let input: unknown
  try {
    input = await context.req.json()
  } catch {
    throw new ApiError(400, 'INVALID_JSON', 'Send a valid JSON body')
  }
  return parse(schema, input)
}
export function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value)
  if (!result.success)
    throw new ApiError(
      422,
      'VALIDATION_ERROR',
      'Input did not match the contract',
      result.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
    )
  return result.data
}
export const param = (context: Context, key: string) => parse(id, context.req.param(key))
