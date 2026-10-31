import { FiDownload } from 'react-icons/fi'
import type { SourceDocument } from '../domain/types'
import { isCadMime } from '../domain/sourceMime'
import { cadAccept, cadExtension } from '../features/import/cadFormat'

const unitsLabel = (units: string) =>
  units === 'unknown'
    ? 'units unknown'
    : { mm: 'millimetres', cm: 'centimetres', m: 'metres', in: 'inches', ft: 'feet' }[units] || units

export function SourceStrip({
  source,
  showImport,
  importFile,
  toggle,
}: {
  source?: SourceDocument
  showImport: boolean
  importFile: (file: File) => Promise<void>
  toggle: () => void
}) {
  const cad = source && isCadMime(source.mime)
  const drawing = cad ? cadExtension(source.name)?.toUpperCase() || 'CAD' : ''
  const sourceLabel = source
    ? `${source.name}${drawing ? ` · ${drawing} drawing` : ''}${source.page ? ` · page ${source.page}` : ''} · ${source.width.toLocaleString()} × ${source.height.toLocaleString()} px`
    : 'No source plan on this level'
  return (
    <div className="source-strip ">
      <span title={sourceLabel}>
        <FiDownload /> {sourceLabel}
        {cad && source.units && <span> · {unitsLabel(source.units)}</span>}
      </span>
      <div>
        <label className="file-button">
          {source ? 'Replace level plan' : 'Import level plan'}
          <input
            type="file"
            accept={`${cadAccept},.png,.jpg,.jpeg,.pdf,image/png,image/jpeg,application/pdf`}
            onChange={async (event) => {
              const chosen = event.target.files?.[0]
              if (chosen) await importFile(chosen)
              event.target.value = ''
            }}
          />
        </label>
        {source && <button onClick={toggle}>{showImport ? 'Close source' : 'Source & scale'}</button>}
      </div>
    </div>
  )
}
