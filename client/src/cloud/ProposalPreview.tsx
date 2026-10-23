import { useEffect, useState } from 'react'
import type { Candidate } from '../../../api/src/contracts/analysis'
import { loadPrivateSource } from './sources'
export function ProposalPreview({
  cacheKey,
  projectId,
  sourceId,
  candidates,
  selected,
  width,
  height,
}: {
  cacheKey: string
  projectId: string
  sourceId: string
  candidates: Candidate[]
  selected: Set<string>
  width: number
  height: number
}) {
  const [url, setUrl] = useState(''),
    [error, setError] = useState('')
  useEffect(() => {
    let alive = true,
      image = ''
    loadPrivateSource(cacheKey, projectId, sourceId)
      .then((blob) => {
        if (alive && blob) {
          image = URL.createObjectURL(blob)
          setUrl(image)
        }
      })
      .catch((error) => {
        if (alive) setError(error.message)
      })
    return () => {
      alive = false
      if (image) URL.revokeObjectURL(image)
    }
  }, [cacheKey, projectId, sourceId])
  const viewHeight = (100 * height) / width
  const path = (candidate: Candidate) => {
    if (!candidate.curve) return undefined
    const curve = candidate.curve,
      delta = curve.endAngle - curve.startAngle
    return Array.from({ length: 65 }, (_, i) => {
      const angle = curve.startAngle + (delta * i) / 64
      return `${(curve.center.x + Math.cos(angle) * curve.radius) * 100},${curve.center.y * viewHeight + Math.sin(angle) * curve.radius * 100}`
    }).join(' ')
  }
  return (
    <>
      <svg
        className="cloud-proposal-preview"
        viewBox={`0 0 100 ${viewHeight}`}
        role="img"
        aria-label="Cloud detections over the uploaded plan"
      >
        {url && <image href={url} width={100} height={viewHeight} />}
        {candidates
          .filter((candidate) => selected.has(candidate.id))
          .map((candidate) => (
            <g key={candidate.id}>
              {candidate.points.length === 1 ? (
                <circle cx={candidate.points[0].x * 100} cy={candidate.points[0].y * viewHeight} r={1} />
              ) : (
                <polyline
                  points={
                    path(candidate) ||
                    candidate.points.map((point) => `${point.x * 100},${point.y * viewHeight}`).join(' ')
                  }
                  fill="none"
                  stroke={
                    candidate.action === 'remove'
                      ? '#bd3434'
                      : candidate.kind === 'wall'
                        ? '#ad6728'
                        : '#006e94'
                  }
                  strokeDasharray={candidate.action === 'remove' ? '.9 .6' : undefined}
                  strokeWidth={0.5}
                />
              )}
              <title>
                {candidate.action === 'remove' ? 'Remove ' : ''}
                {candidate.label || candidate.kind}: {candidate.evidence}
              </title>
            </g>
          ))}
      </svg>
      {error && <p role="alert">{error}</p>}
    </>
  )
}
