import type { Intelligence } from '../../../api/src/contracts/analysis'
import { labelCoverage } from '../../../api/src/modules/plan-analysis/label-coverage'
import './sourceTextReview.css'

export function SourceTextReview({
  proposal,
  dimensions,
}: {
  proposal: Intelligence
  dimensions?: { width: number; height: number }
}) {
  const source = proposal.sourceText
  if (!source) return null
  const readings = new Map(proposal.labelReadings?.map((reading) => [reading.sourceId, reading]))
  const unresolved = new Set(
    labelCoverage(proposal, dimensions)
      .map((issue) => issue.candidateId)
      .filter(Boolean),
  ).size
  return (
    <details className="source-text-review">
      <summary>
        Plan text · {source.items.length} readings{unresolved ? ` · ${unresolved} need review` : ''}
      </summary>
      <p>
        Labels support the area interpretation. Low-confidence text must be checked against the original; OCR
        boxes are not room boundaries.
      </p>
      {source.status !== 'ready' && (
        <p role="status">Text reading was incomplete. Some labels may still need inspection.</p>
      )}
      {source.warnings.map((warning, index) => (
        <p key={index}>{warning}</p>
      ))}
      <ul>
        {source.items.map((item) => {
          const reading = readings.get(item.id)
          return (
            <li key={item.id}>
              <strong>{reading?.reading || item.text}</strong>
              {' · '}
              <span>
                {reading?.role || 'Needs interpretation'} · OCR confidence {Math.round(item.confidence * 100)}
                %
              </span>
              {reading?.reading && reading.reading !== item.text && <p>Original OCR: {item.text}</p>}
              {reading && <p>{reading.reason}</p>}
            </li>
          )
        })}
      </ul>
    </details>
  )
}
