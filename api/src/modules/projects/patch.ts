import type { Change } from '../../contracts/operations'
import type { Project } from '../../contracts/project'
import { ApiError } from '../../security/errors'
const forbidden = new Set(['__proto__', 'prototype', 'constructor', 'id', 'modified'])
export function applyChanges(input: Project, changes: Change[], modifiedAt: number): Project {
  const result = structuredClone(input)
  for (const change of changes) {
    if (change.path.some((part) => forbidden.has(part)))
      throw new ApiError(422, 'INVALID_PATH', 'Immutable or unsafe property')
    if (
      change.path.length === 1 &&
      !['name', 'units', 'calibration', 'interpretation'].includes(change.path[0])
    ) {
      throw new ApiError(422, 'INVALID_PATH', 'Use entity changes instead of replacing the document')
    }
    let parent: any = result
    for (const part of change.path.slice(0, -1)) {
      parent = Array.isArray(parent) ? parent.find((item) => item?.id === part) : parent?.[part]
      if (!parent || typeof parent !== 'object')
        throw new ApiError(422, 'INVALID_PATH', 'Change target does not exist')
    }
    const key = change.path.at(-1)!
    if (Array.isArray(parent)) {
      const index = parent.findIndex((item) => item?.id === key)
      if (change.action === 'delete') {
        if (index === -1) throw new ApiError(422, 'INVALID_PATH', 'Entity does not exist')
        parent.splice(index, 1)
      } else {
        const value = change.value
        if (!value || typeof value !== 'object' || !('id' in value) || value.id !== key) {
          throw new ApiError(422, 'INVALID_PATH', 'Entity ID must match its path')
        }
        if (index === -1) parent.push(structuredClone(value))
        else parent[index] = structuredClone(value)
      }
    } else {
      if (change.action === 'delete') delete parent[key]
      else parent[key] = structuredClone(change.value)
    }
  }
  result.modified = modifiedAt
  return result
}
