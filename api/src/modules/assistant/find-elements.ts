import type { EditWorkspace } from './edits'
import { scopeContext } from './scope'
import { collections, describeSchema } from './entities'

export function findElements(work: EditWorkspace, query: string) {
  const { building } = scopeContext(work.document, work.scope),
    text = query.toLowerCase(),
    matches: any[] = []
  for (const floor of building.levels) {
    if (`${floor.name} ${floor.id}`.toLowerCase().includes(text))
      matches.push({ kind: 'level', id: floor.id, name: floor.name })
    for (const [kind, collection] of Object.entries(collections))
      for (const e of (floor as any)[collection] || [])
        if (`${e.id} ${e.name || ''} ${e.type || ''} ${kind}`.toLowerCase().includes(text))
          matches.push({ kind, levelId: floor.id, element: e })
  }
  for (const e of building.systems?.systems || [])
    if (`${e.id} ${e.name} ${e.kind}`.toLowerCase().includes(text))
      matches.push({ kind: 'system', element: e })
  const kinds = [...new Set(matches.slice(0, 100).map((m) => m.kind as keyof typeof collections))].filter(
    (k) => k in collections,
  )
  return {
    items: matches.slice(0, 100),
    total: matches.length,
    schemas: Object.fromEntries(kinds.slice(0, 3).map((k) => [k, describeSchema(k)])),
  }
}
