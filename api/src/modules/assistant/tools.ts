import { z } from 'zod'
import type { FunctionDeclaration } from '@google/genai'
import { id } from '../../contracts/primitives'
import { editCommand, elementKinds } from '../../contracts/assistant'
import { EditWorkspace } from './edits'
import { collections, findTarget, describeSchema } from './entities'
import { scopeContext } from './scope'
import { furnitureTypes } from '../../../../client/src/furniture/types'
const definitions = {
  inspect_model: {
    description:
      'Get building/floor names, dimensions, selection, roof and linked floor groups. Read this before editing.',
    schema: z.object({}).strict(),
  },
  inspect_level: {
    description: 'Inspect one floor in this building. Geometry is metres. Paginate collections with offset.',
    schema: z
      .object({
        levelId: id,
        collection: z.enum(Object.values(collections) as [string, ...string[]]).optional(),
        offset: z.number().int().min(0).default(0),
      })
      .strict(),
  },
  inspect_entity: {
    description: 'Read an existing entity and its related host wall. Use returned IDs.',
    schema: z.object({ kind: z.enum(elementKinds), id }).strict(),
  },
  find_elements: {
    description: 'Find named rooms, floors, systems, or entities by ID/type in the selected building.',
    schema: z.object({ query: z.string().min(1).max(200) }).strict(),
  },
  inspect_schema: {
    description:
      'Get exact supported properties and enums for a model kind before set/create. Furniture assetId is furniture type.',
    schema: z.object({ kind: z.enum(elementKinds) }).strict(),
  },
  edit_model: {
    description:
      'Prepare semantic commands on a working copy. properties is a JSON object encoded as a string. Never change existing IDs. Creating returns server-assigned IDs. No changes are applied to the live model.',
    schema: z.object({ commands: z.array(editCommand).min(1).max(100) }).strict(),
  },
  validate_model: {
    description: 'Check the complete proposal and report errors before telling the user it is ready.',
    schema: z.object({}).strict(),
  },
}
export const editingTools: FunctionDeclaration[] = Object.entries(definitions).map(([name, definition]) => ({
  name,
  description: definition.description,
  parametersJsonSchema: z.toJSONSchema(definition.schema),
}))
export function executeTool(work: EditWorkspace, name: string, args: unknown) {
  if (!(name in definitions)) throw new Error('Unsupported assistant tool')
  const input: any = definitions[name as keyof typeof definitions].schema.parse(args)
  const { building, level } = scopeContext(work.document, work.scope)
  if (name === 'inspect_model')
    return {
      units: 'metres',
      scope: work.scope,
      building: {
        id: building.id,
        name: building.name,
        roof: building.roof,
        roofSections: building.roofSections,
        systems: building.systems,
      },
      floors: building.levels.map((l) => ({
        id: l.id,
        name: l.name,
        elevation: l.elevation,
        height: l.floorToFloorHeight,
        locked: l.locked,
        rooms: l.rooms.map((r) => ({ id: r.id, name: r.name })),
      })),
      activeLevelId: level.id,
    }
  if (name === 'inspect_schema')
    return {
      schema: describeSchema(input.kind),
      ...(input.kind === 'furniture' ? { assetIds: furnitureTypes } : {}),
    }
  if (name === 'inspect_entity') {
    const target = findTarget(work.document, input.kind, input.id)
    if (target.building.id !== building.id) throw new Error('Element is outside the selected building')
    return {
      element: target.value,
      schema: describeSchema(input.kind),
      levelId: target.level?.id,
      host: target.value?.wallId ? target.level?.walls.find((w) => w.id === target.value.wallId) : undefined,
    }
  }
  if (name === 'inspect_level') {
    const target = building.levels.find((l) => l.id === input.levelId)
    if (!target) throw new Error('Floor not found in this building')
    if (input.collection) {
      const items = (target as any)[input.collection] || [],
        kind = Object.entries(collections).find(
          ([, c]) => c === input.collection,
        )![0] as keyof typeof collections
      return {
        items: items.slice(input.offset, input.offset + 100),
        schema: describeSchema(kind),
        total: items.length,
        nextOffset: input.offset + 100 < items.length ? input.offset + 100 : null,
      }
    }
    return {
      id: target.id,
      name: target.name,
      elevation: target.elevation,
      roof: target.roof,
      counts: Object.fromEntries(Object.values(collections).map((c) => [c, (target[c] || []).length])),
      rooms: target.rooms.slice(0, 30),
      walls: target.walls.slice(0, 30),
      doors: target.doors.slice(0, 20),
      slabs: target.slabs?.slice(0, 10),
      stairs: target.stairs?.slice(0, 10),
      furniture: target.furniture?.slice(0, 20),
      note: 'Collections are capped here; request a specific collection to paginate the rest. Prefer connect-stair to create its upper slab opening together.',
    }
  }
  if (name === 'find_elements') {
    const query = input.query.toLowerCase(),
      matches: any[] = []
    for (const floor of building.levels) {
      if (`${floor.name} ${floor.id}`.toLowerCase().includes(query))
        matches.push({ kind: 'level', id: floor.id, name: floor.name })
      for (const [kind, collection] of Object.entries(collections))
        for (const e of (floor as any)[collection] || [])
          if (`${e.id} ${e.name || ''} ${e.type || ''} ${kind}`.toLowerCase().includes(query))
            matches.push({ kind, levelId: floor.id, element: e })
    }
    for (const e of building.systems?.systems || [])
      if (`${e.id} ${e.name} ${e.kind}`.toLowerCase().includes(query))
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
  if (name === 'edit_model') {
    const before = structuredClone(work.document),
      allowed = new Set(work.allowed),
      count = work.descriptions.length
    try {
      return { results: input.commands.map((c: unknown) => work.apply(c)) }
    } catch (error) {
      work.document = before
      work.allowed = allowed
      work.descriptions.length = count
      throw error
    }
  }
  if (name === 'validate_model') {
    const proposal = work.proposal()
    return { valid: true, changes: proposal.changes.length, descriptions: proposal.descriptions }
  }
  throw new Error('Unsupported assistant tool')
}
