import type { Project } from '../domain/types'
import { buildCadScene, type CadSceneOptions } from './scene'
import { cadSheetName } from './sheetName'
import { writeDxf } from './dxf-writer'

export function saveBlob(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob),
    link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Local and device projects never leave the browser: same scene, same writer, disk only. */
export function downloadDxf(project: Project, options: CadSceneOptions) {
  const sheet = writeDxf(buildCadScene(project, options))
  saveBlob(cadSheetName(project, options, 'dxf'), new Blob([sheet], { type: 'image/vnd.dxf' }))
}
