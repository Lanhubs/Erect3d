import type { Operation, Project } from '../../../api/client'
export type Change = Operation['payload']['changes'][number]
export function atPath(document: Project, path: string[]): unknown {
  let value: unknown = document
  for (const key of path)
    value = Array.isArray(value)
      ? value.find((item) => item?.id === key)
      : (value as Record<string, unknown> | undefined)?.[key]
  return value
}
export function patch(document: Project, changes: Change[]): Project {
  const result = structuredClone(document)
  for (const change of changes) {
    if (
      !change.path.length ||
      change.path.some((key) => ['__proto__', 'prototype', 'constructor', 'id', 'modified'].includes(key))
    )
      throw new Error('Unsafe change path')
    let parent: unknown = result
    for (const key of change.path.slice(0, -1))
      parent = Array.isArray(parent)
        ? parent.find((item) => item?.id === key)
        : (parent as Record<string, unknown>)?.[key]
    if (!parent || typeof parent !== 'object')
      throw new Error(`The target was removed: ${change.path.join(' / ')}`)
    const key = change.path.at(-1)!
    if (Array.isArray(parent)) {
      const index = parent.findIndex((item) => item?.id === key)
      if (change.action === 'delete') {
        if (index >= 0) parent.splice(index, 1)
      } else if (index >= 0) parent[index] = structuredClone(change.value)
      else parent.push(structuredClone(change.value))
    } else if (change.action === 'delete') delete (parent as Record<string, unknown>)[key]
    else (parent as Record<string, unknown>)[key] = structuredClone(change.value)
  }
  result.modified = Date.now()
  return result
}
export function downloadDocument(project: Project, suffix = 'draft') {
  const url = URL.createObjectURL(new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `${project.name}-${suffix}.json`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
