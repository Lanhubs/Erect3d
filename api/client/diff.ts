import type { Project } from '../../client/src/domain/types'
import type { Change } from '../src/contracts/operations'
const immutable = new Set(['id', 'modified'])
export function documentChanges(before: Project, after: Project): Change[] {
  const changes: Change[] = []
  function visit(left: unknown, right: unknown, path: string[]) {
    if (JSON.stringify(left) === JSON.stringify(right)) return
    if (
      Array.isArray(left) &&
      Array.isArray(right) &&
      [...left, ...right].every((item) => item && typeof item === 'object' && 'id' in item)
    ) {
      const old = new Map(left.map((item) => [item.id, item])),
        next = new Map(right.map((item) => [item.id, item]))
      for (const [id] of old) if (!next.has(id)) changes.push({ action: 'delete', path: [...path, id] })
      for (const [id, value] of next) {
        if (!old.has(id)) changes.push({ action: 'put', path: [...path, id], value })
        else visit(old.get(id), value, [...path, id])
      }
    } else if (
      left &&
      right &&
      !Array.isArray(left) &&
      !Array.isArray(right) &&
      typeof left === 'object' &&
      typeof right === 'object'
    ) {
      const old = left as Record<string, unknown>,
        next = right as Record<string, unknown>
      for (const key of new Set([...Object.keys(old), ...Object.keys(next)])) {
        if (immutable.has(key)) continue
        if (!(key in next) || next[key] === undefined) {
          if (old[key] !== undefined) changes.push({ action: 'delete', path: [...path, key] })
        } else visit(old[key], next[key], [...path, key])
      }
    } else if (right === undefined) changes.push({ action: 'delete', path })
    else changes.push({ action: 'put', path, value: right })
  }
  visit(before, after, [])
  return changes
}
