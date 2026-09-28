import type { Calibration, SourceDocument } from '../domain/types'
import { ScaleControls } from '../features/import/ScaleControls'

export function SourceScalePreview({ source, url, calibration, groundScale, onApply, onPoints, onClose, onReuse }: {
  source: SourceDocument; url: string; calibration: Calibration; groundScale?: Calibration;
  onApply: (metres: number) => void; onPoints: () => void; onClose: () => void; onReuse: () => void
}) {
  return <div className="source-preview">
    <img src={url} alt="Imported floor plan" />
    <div className="source-scale-sidebar"><ScaleControls key={`${source.id}:${calibration.knownMetres}`} calibration={calibration} onApply={onApply}
      onPoints={onPoints} onClose={onClose} />
      {groundScale && <button className="reuse-scale" onClick={onReuse}>Use Ground Floor Scale</button>}
    </div>
  </div>
}
