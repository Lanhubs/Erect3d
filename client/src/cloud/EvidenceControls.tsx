import { useEffect, useState } from 'react'
import type { Calibration, SourceDocument } from '../domain/types'
import { useAnalysis } from '../features/import/useAnalysis'
import { loadPrivateSource } from './sources'
export type Region = { x: number; y: number; width: number; height: number }
export function EvidenceControls({
  source,
  calibration,
  cacheKey,
  projectId,
  disabled,
  region,
  setRegion,
  measurements = true,
}: {
  source: SourceDocument
  calibration?: Calibration
  cacheKey: string
  projectId: string
  disabled: boolean
  region?: Region
  setRegion: (region?: Region) => void
  measurements?: boolean
}) {
  const analysis = useAnalysis(),
    [url, setUrl] = useState(''),
    [error, setError] = useState('')
  const [start, setStart] = useState<{ x: number; y: number }>()
  useEffect(() => {
    let alive = true,
      objectUrl = ''
    loadPrivateSource(cacheKey, projectId, source.id)
      .then((blob) => {
        if (alive && blob) {
          objectUrl = URL.createObjectURL(blob)
          setUrl(objectUrl)
        }
      })
      .catch((error) => {
        if (alive) setError(error.message)
      })
    return () => {
      alive = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [cacheKey, projectId, source.id])
  const busy = ['preparing', 'analyzing', 'building'].includes(analysis.status)
  const analyze = () => {
    if (calibration && url) void analysis.analyze(url, { ...calibration, method: 'manual' }, source)
  }
  const coordinate = (event: React.PointerEvent<SVGSVGElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    return {
      x: Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)),
      y: Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height)),
    }
  }
  return (
    <details>
      <summary>
        {measurements ? 'OpenCV evidence and regional analysis' : 'Choose a floor on a sheet'}
      </summary>
      {measurements && (
        <button disabled={disabled || busy || !url || !calibration} onClick={analyze}>
          {busy ? `${analysis.status}…` : 'Measure plan with OpenCV'}
        </button>
      )}
      <p>
        {measurements ? 'Measurements do not change the model. ' : ''}If this sheet contains several plans,
        select one complete floor below. Reconstruction uses that area; the full source remains available as
        context.
      </p>
      {!region && (
        <button disabled={disabled} onClick={() => setRegion({ x: 0, y: 0, width: 1, height: 1 })}>
          Specify region with keyboard
        </button>
      )}
      {region && (
        <div className="cloud-inline">
          {(['x', 'y', 'width', 'height'] as const).map((key) => (
            <label key={key}>
              {key} %
              <input
                type="number"
                min={key === 'width' || key === 'height' ? 1 : 0}
                max={100}
                step={1}
                disabled={disabled}
                value={Number((region[key] * 100).toFixed(2))}
                onChange={(event) => {
                  const next = {
                    ...region,
                    [key]: Math.max(
                      key === 'width' || key === 'height' ? 0.01 : 0,
                      Math.min(1, Number(event.target.value) / 100),
                    ),
                  }
                  next.x = Math.min(0.99, next.x)
                  next.y = Math.min(0.99, next.y)
                  next.width = Math.min(next.width, 1 - next.x)
                  next.height = Math.min(next.height, 1 - next.y)
                  setRegion(next)
                }}
              />
            </label>
          ))}
        </div>
      )}
      {url && (
        <svg
          viewBox={`0 0 100 ${(100 * source.height) / source.width}`}
          style={{
            width: '100%',
            display: 'block',
            touchAction: 'none',
            cursor: disabled ? 'default' : 'crosshair',
          }}
          role="img"
          aria-label="Drag an analysis region on the source plan"
          onPointerDown={(event) => {
            if (disabled) return
            event.currentTarget.setPointerCapture(event.pointerId)
            setStart(coordinate(event))
          }}
          onPointerUp={(event) => {
            if (!start || disabled) return
            const end = coordinate(event),
              width = Math.abs(end.x - start.x),
              height = Math.abs(end.y - start.y)
            if (width > 0.01 && height > 0.01)
              setRegion({ x: Math.min(start.x, end.x), y: Math.min(start.y, end.y), width, height })
            setStart(undefined)
          }}
          onPointerCancel={() => setStart(undefined)}
        >
          <image href={url} width={100} height={(100 * source.height) / source.width} />
          {region && (
            <rect
              x={region.x * 100}
              y={(region.y * 100 * source.height) / source.width}
              width={region.width * 100}
              height={(region.height * 100 * source.height) / source.width}
              fill="#006e9422"
              stroke="#006e94"
              strokeWidth={0.5}
            />
          )}
        </svg>
      )}
      {region && (
        <button disabled={disabled} onClick={() => setRegion(undefined)}>
          Analyze complete drawing
        </button>
      )}
      {error || analysis.error ? <p role="alert">{error || analysis.error}</p> : null}
    </details>
  )
}
