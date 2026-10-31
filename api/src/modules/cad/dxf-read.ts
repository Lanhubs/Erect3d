import DxfParser from 'dxf-parser'
import type { IBlock, IDxf, IEntity, ILayer } from 'dxf-parser'
import { CadFailure } from './types'

export type DxfModel = {
  header: Record<string, unknown>
  layers: Record<string, ILayer>
  blocks: Record<string, IBlock>
  entities: IEntity[]
}
type Parser = { parseSync(source: string): IDxf }

function asModel(parsed: IDxf | null | undefined, maxEntities: number): DxfModel {
  const value = (parsed || {}) as Partial<IDxf>
  const entities = Array.isArray(value.entities) ? value.entities : []
  if (entities.length > maxEntities)
    throw new CadFailure(
      'DXF_TOO_COMPLEX',
      `Drawing has ${entities.length} entities; the limit is ${maxEntities}`,
    )
  return {
    header: (value.header || {}) as Record<string, unknown>,
    layers: (value.tables?.layer?.layers || {}) as Record<string, ILayer>,
    blocks: (value.blocks || {}) as Record<string, IBlock>,
    entities,
  }
}

/** Parses ASCII DXF model space and drops frozen/hidden layers before any geometry work. */
export function parseDxf(text: string, maxEntities: number): DxfModel {
  const parser: Parser = new (DxfParser as unknown as new () => Parser)()
  let parsed: IDxf
  try {
    parsed = parser.parseSync(text)
  } catch (error) {
    throw new CadFailure('DXF_PARSE_FAILED', `DXF parse failed: ${(error as Error)?.message || 'unknown'}`)
  }
  const model = asModel(parsed, maxEntities)
  if (!model.entities.length) throw new CadFailure('DXF_EMPTY', 'The drawing has no model-space geometry')
  const offLayer = (entity: IEntity) => {
    const layer = model.layers[entity.layer || '']
    return entity.visible === false || layer?.frozen === true || layer?.visible === false
  }
  const visible = model.entities.filter((entity) => entity && !offLayer(entity))
  if (!visible.length)
    throw new CadFailure('DXF_EMPTY', 'Every layer in the drawing is switched off or frozen')
  return { ...model, entities: visible }
}
