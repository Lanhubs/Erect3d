import { z } from 'zod'
// A homogeneous string row keeps Gemini's already large geometry grammar small.
// The canonical ID, role, size and target constraints remain server validated.
export const labelReadingWire = z.array(z.array(z.string())).max(300)
export const labelReadingGeneration = { type: 'array', items: { type: 'array', items: { type: 'string' } } }
export function canonicalLabelReadings(value: unknown): unknown {
  if (!Array.isArray(value)) return value
  return value.map((row) =>
    Array.isArray(row) && row.length === 5 && row.every((item) => typeof item === 'string')
      ? {
          sourceId: row[0],
          role: row[1],
          reading: row[2],
          candidateIds: row[3]
            .split(',')
            .map((id: string) => id.trim())
            .filter(Boolean),
          reason: row[4],
        }
      : row,
  )
}
