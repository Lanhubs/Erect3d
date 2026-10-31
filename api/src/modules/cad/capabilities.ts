import type { Config } from '../../config/env'
import { converterAvailable } from './dwg'

export type CadCapabilities = { dwgImport: boolean; dwgExport: boolean }

const cache = new Map<string, Promise<CadCapabilities>>()

/** Probes converter binaries once per configured path pair; requests never execute them. */
export function cadCapabilities(config: Pick<Config, 'DWG_CONVERTER_PATH' | 'DXF_TO_DWG_CONVERTER_PATH'>) {
  const key = `${config.DWG_CONVERTER_PATH || ''}|${config.DXF_TO_DWG_CONVERTER_PATH || ''}`
  let probed = cache.get(key)
  if (!probed) {
    probed = Promise.all([
      converterAvailable(config.DWG_CONVERTER_PATH),
      converterAvailable(config.DXF_TO_DWG_CONVERTER_PATH),
    ]).then(([dwgImport, dwgExport]) => ({ dwgImport, dwgExport }))
    cache.set(key, probed)
  }
  return probed
}
