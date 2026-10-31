import type { SourceDocument } from '../domain/types'
import { SourceTextReview } from './SourceTextReview'
import type { Analysis } from './proposalReviewModel'

/** Everything the server said about this reconstruction, before any of it touches the model. */
export function ProposalAnalysisReport({
  analysis,
  source,
  backend,
  rebuilding,
}: {
  analysis: Analysis
  source: SourceDocument
  backend: boolean
  rebuilding: boolean
}) {
  return (
    <>
      <p>
        {analysis.status === 'accepted'
          ? 'Accepted into the model. Use the editor’s Undo action to restore the previous model.'
          : backend
            ? 'Review the source overlay and proposed 3D model. Open detected details if you need to correct an element.'
            : 'Select and review each model change before accepting. Doors and windows need their host walls; unselected changes are discarded.'}
      </p>
      {!!analysis.result?.proposal.warnings.length && (
        <details>
          <summary>Interpretation notes · {analysis.result.proposal.warnings.length}</summary>
          {analysis.result.proposal.warnings.map((warning, i) => (
            <p key={i}>{warning}</p>
          ))}
        </details>
      )}
      {backend && analysis.result?.quality && (
        <details open={analysis.result.quality.status === 'blocked'}>
          <summary>Server model checks · {analysis.result.quality.status}</summary>
          {analysis.result.quality.issues.map((issue, i) => (
            <p key={i}>
              {issue.severity === 'error' ? 'Needs correction: ' : ''}
              {issue.message}
            </p>
          ))}
        </details>
      )}
      {analysis.result?.proposal && (
        <SourceTextReview
          proposal={analysis.result.proposal}
          dimensions={{ width: source.width, height: source.height }}
        />
      )}
      {rebuilding && (
        <p>
          Applying replaces this floor’s detected geometry with the reviewed reconstruction. Other floors and
          your roof choices are preserved. Undo is available.
        </p>
      )}
      {analysis.result?.proposal.understanding && (
        <details>
          <summary>Building understanding · {analysis.result.proposal.understanding.buildingType}</summary>
          <p>{analysis.result.proposal.understanding.circulation.join(' · ')}</p>
          <p>{analysis.result.proposal.understanding.conventions.join(' · ')}</p>
          {analysis.result.proposal.understanding.uncertainties.map((text, i) => (
            <p key={i}>{text}</p>
          ))}
        </details>
      )}
    </>
  )
}
