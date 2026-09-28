import { FiDownload } from 'react-icons/fi'
import type { SourceDocument } from '../domain/types'

export function SourceStrip({ source, showImport, importFile, toggle }: { source?: SourceDocument; showImport: boolean;
  importFile: (file: File) => Promise<void>; toggle: () => void }) {
  return <div className="source-strip">
    <span><FiDownload /> {source ? `${source.name}${source.page ? ` · page ${source.page}` : ''} · ${source.width.toLocaleString()} × ${source.height.toLocaleString()} px` : 'No source plan on this level'}</span>
    <div><label className="file-button">{source ? 'Replace level plan' : 'Import level plan'}
      <input type="file" accept=".png,.jpg,.jpeg,.pdf,image/png,image/jpeg,application/pdf"
        onChange={async event => { const chosen = event.target.files?.[0]; if (chosen) await importFile(chosen); event.target.value = '' }} />
    </label>{source && <button onClick={toggle}>{showImport ? 'Close source' : 'Source & scale'}</button>}</div>
  </div>
}
