import { useState } from 'react'
import type { Calibration } from '../../domain/types'

export function ScaleControls({ calibration, onApply, onPoints, onClose }: {
  calibration: Calibration; onApply: (metres: number) => void; onPoints: () => void; onClose: () => void
}) {
  const [span, setSpan] = useState(() => (calibration.knownMetres || 12).toFixed(2))
  const [error, setError] = useState('')
  const apply = () => {
    const value = Number(span)
    if (!Number.isFinite(value) || value <= 0) { setError('Enter a size greater than zero.'); return }
    setError(''); onApply(value)
  }
  return <div className="scale-controls">
    <strong>{calibration.method === 'auto' ? 'Scale estimated automatically' : 'Plan scale'}</strong>
    <span>{calibration.method === 'auto' ? 'Ready to generate 3D. This is an estimate because image pixels alone do not specify real dimensions.'
      : 'The current scale is saved with this plan.'}</span>
    <label>{calibration.method === 'auto' ? 'Estimated plan span' : 'Reference distance'} · m
      <input type="number" min="0.1" step="0.1" value={span} onChange={event => setSpan(event.target.value)} />
    </label>
    {error && <small className="error">{error}</small>}
    <button onClick={apply}>Apply size</button>
    <button onClick={onPoints}>Use two points for exact scale</button>
    <button onClick={onClose}>Return to plan</button>
  </div>
}
