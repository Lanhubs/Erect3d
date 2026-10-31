import { useEffect, useState } from 'react'
import { FiCloud, FiFile } from 'react-icons/fi'
import { capabilities } from '../cloud/api'
import { exportCadSheet } from '../cloud/cadExport'
import { cloudPersistence } from '../state/persistenceMode'
import { useProject } from '../state/project'
import { downloadDxf, saveBlob } from './download'
import type { CadSceneOptions } from './scene'
import type { CadSheetFormat } from './sheetName'

/** The sheet the header offers: one storey, or every storey stacked at its authored height. */
export function ExportMenu() {
  const project = useProject((state) => state.project),
    activeLevelId = useProject((state) => state.activeLevelId),
    readOnly = useProject((state) => state.readOnly)
  const [dwgReady, setDwgReady] = useState(false),
    [status, setStatus] = useState(''),
    [error, setError] = useState('')
  useEffect(() => {
    let alive = true
    capabilities()
      .then((ready) => {
        if (alive) setDwgReady(Boolean(ready.dwgExport))
      })
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [])
  if (!project) return null
  const levels = project.buildings[0]?.levels || [],
    level = levels.find((item) => item.id === activeLevelId) || levels[0],
    cloud = cloudPersistence()?.projectId === project.id,
    thisFloor: CadSceneOptions = { levelId: level?.id },
    everyFloor: CadSceneOptions = { allLevels: true },
    dwgBlocked = !cloud || !dwgReady || readOnly,
    dwgReason = readOnly
      ? 'This project is open read only, so the server cannot be asked to draw a DWG.'
      : !cloud
        ? 'DWG needs the server converter. A DXF sheet opens in the same CAD tools.'
        : !dwgReady
          ? 'This server has no DWG converter installed. A DXF sheet opens in the same CAD tools.'
          : 'DWG export is experimental: the server converts this DXF sheet with LibreDWG.',
    draw = (format: CadSheetFormat, options: CadSceneOptions) => async () => {
      setError('')
      setStatus(format === 'dwg' ? 'Drawing the DWG sheet on the server…' : 'Drawing the DXF sheet…')
      try {
        if (format === 'dwg') {
          const sheet = await exportCadSheet(project, format, options)
          saveBlob(sheet.name, sheet.blob)
        } else downloadDxf(project, options)
      } catch (cause) {
        setError((cause as Error).message)
      } finally {
        setStatus('')
      }
    }
  return (
    <details className="studio-menu studio-export">
      <summary aria-label="Export drawing" data-tooltip="Export a DXF or DWG sheet for CAD tools">
        <FiFile />
      </summary>
      <div>
        <strong>Take this building to CAD</strong>
        <button onClick={draw('dxf', thisFloor)}>
          <FiFile />
          <span>DXF · this floor</span>
        </button>
        <button onClick={draw('dxf', everyFloor)} disabled={levels.length < 2}>
          <FiFile />
          <span>DXF · all floors</span>
        </button>
        <button onClick={draw('dwg', thisFloor)} disabled={dwgBlocked || Boolean(status)}>
          <FiCloud />
          <span>DWG · this floor</span>
        </button>
        <p>{dwgReason}</p>
        {status && <p role="status">{status}</p>}
        {error && (
          <p role="alert" className="studio-export-error">
            {error}
          </p>
        )}
        <p>Sheets are in metres, one layer per element, with your floor names and room labels.</p>
      </div>
    </details>
  )
}
