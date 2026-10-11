import { useEffect, useState } from 'react'
import type { Candidate } from '../../../api/src/contracts/analysis'
import { loadPrivateSource } from './sources'
export function ProposalPreview({ cacheKey, projectId, sourceId, candidates, selected }: { cacheKey: string; projectId: string; sourceId: string; candidates: Candidate[]; selected: Set<string> }) {
  const [url, setUrl] = useState(''), [error, setError] = useState('')
  useEffect(() => {
    let alive = true, image = ''
    loadPrivateSource(cacheKey, projectId, sourceId).then(blob => {
      if (alive && blob) { image = URL.createObjectURL(blob); setUrl(image) }
    }).catch(error => { if (alive) setError(error.message) })
    return () => { alive = false; if (image) URL.revokeObjectURL(image) }
  }, [cacheKey, projectId, sourceId])
  return <><svg className="cloud-proposal-preview" viewBox="0 0 100 100" role="img" aria-label="Cloud detections over the uploaded plan">
    {url && <image href={url} width={100} height={100} preserveAspectRatio="none" />}
    {candidates.filter(candidate => selected.has(candidate.id)).map(candidate => <g key={candidate.id}>
      {candidate.points.length === 1 ? <circle cx={candidate.points[0].x * 100} cy={candidate.points[0].y * 100} r={1} /> :
        <polyline points={candidate.points.map(point => `${point.x * 100},${point.y * 100}`).join(' ')} fill="none" stroke={candidate.kind === 'wall' ? '#ad6728' : '#006e94'} strokeWidth={.5} />}
      <title>{candidate.label || candidate.kind}: {candidate.evidence}</title>
    </g>)}
  </svg>{error && <p role="alert">{error}</p>}</>
}
