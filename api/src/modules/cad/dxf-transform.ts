import type { IBlock, IEntity } from 'dxf-parser'
import { CadFailure } from './types'
import type { DxfModel } from './dxf-read'

export type CadTransform = { x: number; y: number; scaleX: number; scaleY: number; rotation: number }
export type PlacedEntity = { entity: IEntity; transform: CadTransform }

const identity: CadTransform = { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 }
const maxDepth = 8

export function compose(parent: CadTransform, child: CadTransform): CadTransform {
  // Blocks are authored about their own origin, so the parent transform wraps the insert.
  const cos = Math.cos(parent.rotation),
    sin = Math.sin(parent.rotation)
  return {
    x: parent.x + (child.x * cos - child.y * sin) * parent.scaleX,
    y: parent.y + (child.x * sin + child.y * cos) * parent.scaleY,
    scaleX: parent.scaleX * child.scaleX,
    scaleY: parent.scaleY * child.scaleY,
    rotation: parent.rotation + child.rotation,
  }
}

export const scaleOf = (transform: CadTransform) =>
  (Math.abs(transform.scaleX) + Math.abs(transform.scaleY)) / 2 || 1

function insertTransform(entity: IEntity): CadTransform {
  const insert = entity as unknown as {
    position?: { x: number; y: number }
    xScale?: number
    yScale?: number
    rotation?: number
  }
  return {
    x: insert.position?.x || 0,
    y: insert.position?.y || 0,
    scaleX: insert.xScale || 1,
    scaleY: insert.yScale || 1,
    rotation: ((insert.rotation || 0) * Math.PI) / 180,
  }
}

/** Walks model space, expanding INSERT references into the entities they place. */
export function placeEntities(model: DxfModel, maxEntities: number): PlacedEntity[] {
  const placed: PlacedEntity[] = [],
    blocks = model.blocks
  const visit = (entities: IEntity[], transform: CadTransform, stack: string[], depth: number) => {
    for (const entity of entities) {
      if (!entity) continue
      if (placed.length >= maxEntities)
        throw new CadFailure('DXF_TOO_COMPLEX', `Drawing expands past ${maxEntities} entities`)
      if (entity.type === 'INSERT') {
        const name = (entity as unknown as { name?: string }).name || ''
        const block: IBlock | undefined = blocks[name]
        if (!block || depth >= maxDepth || stack.includes(name)) continue
        visit(block.entities || [], compose(transform, insertTransform(entity)), [...stack, name], depth + 1)
        continue
      }
      placed.push({ entity, transform })
    }
  }
  visit(model.entities, identity, [], 0)
  return placed
}
