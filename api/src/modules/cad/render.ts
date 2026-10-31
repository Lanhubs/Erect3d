import { parseDxf } from './dxf-read'
import { placeEntities } from './dxf-transform'
import { tessellate } from './dxf-tessellate'
import { sceneToSvg } from './svg'
import { maximumRasterSide, svgToPng } from './raster'
import { unitMetres, unitsFromHeader } from './units'
import { CadFailure, type CadConversionResult, type CadLimits } from './types'

/** ASCII DXF text in, analysis-ready PNG out, with the exact scale when the drawing declares units. */
export async function dxfToRaster(text: string, limits: CadLimits): Promise<CadConversionResult> {
  const model = parseDxf(text, limits.maxEntities),
    scene = tessellate(placeEntities(model, limits.maxEntities))
  if (!Number.isFinite(scene.bounds.minX) || (!scene.strokes.length && !scene.labels.length))
    throw new CadFailure('DXF_EMPTY', 'The drawing has nothing that can be drawn')
  const units = unitsFromHeader(model.header),
    page = sceneToSvg(scene, maximumRasterSide),
    png = await svgToPng(page.svg, page.width, page.height),
    metresPerUnit = unitMetres(units)
  return {
    format: 'dxf',
    png,
    width: page.width,
    height: page.height,
    units,
    metresPerPixel: metresPerUnit ? metresPerUnit / page.pixelsPerUnit : null,
    entityCount: scene.entityCount,
    warnings: metresPerUnit ? [] : ['units-unknown'],
  }
}
