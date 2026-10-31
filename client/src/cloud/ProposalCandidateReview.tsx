import type { Dispatch, SetStateAction } from 'react'
import type { Candidate } from '../../../api/src/contracts/analysis'
import type { DesignProposal } from '../../../api/src/contracts/design'
import { CandidateDetails } from './CandidateDetails'
import { DesignReview } from './DesignReview'
import { chooseCandidate, rebuildSelection, toggleId } from './proposalReviewModel'

/** The per-element review list: what each candidate changes, which hosts it needs and what is unconfirmed. */
export function ProposalCandidateReview({
  candidates,
  selected,
  select,
  allowConfirmed,
  selectAllowConfirmed,
  designs,
  selectedDesigns,
  selectDesigns,
  walls,
  update,
  disabled,
  backend,
}: {
  candidates: Candidate[]
  selected: Set<string>
  select: Dispatch<SetStateAction<Set<string>>>
  allowConfirmed: Set<string>
  selectAllowConfirmed: Dispatch<SetStateAction<Set<string>>>
  designs: DesignProposal[]
  selectedDesigns: Set<string>
  selectDesigns: Dispatch<SetStateAction<Set<string>>>
  walls: { id: string; label?: string }[]
  update: (candidate: Candidate) => void
  disabled: boolean
  backend: boolean
}) {
  return (
    <details>
      <summary>Edit detected details · {candidates.length} elements</summary>
      {backend && (
        <button disabled={disabled} onClick={() => select(rebuildSelection(candidates))}>
          Select complete reconstruction
        </button>
      )}
      <div className="cloud-candidates">
        {candidates.map((candidate) => (
          <article key={candidate.id}>
            <label>
              <input
                type="checkbox"
                checked={selected.has(candidate.id)}
                disabled={disabled || candidate.kind === 'unknown'}
                onChange={(e) =>
                  select((previous) =>
                    e.target.checked
                      ? chooseCandidate(previous, candidate, candidates)
                      : toggleId(previous, candidate.id, false),
                  )
                }
              />
              {candidate.action === 'remove'
                ? `Remove existing ${candidate.kind}`
                : `${candidate.label || candidate.kind} · ${Math.round(candidate.confidence * 100)}% confidence`}
            </label>
            {candidate.targetId && (
              <>
                <p>
                  {candidate.action === 'remove' ? 'Removes' : 'Updates'} existing {candidate.kind} ·{' '}
                  {candidate.targetId}
                </p>
                {(candidate.confirmedFields?.length || 0) > 0 && (
                  <label>
                    <input
                      type="checkbox"
                      disabled={disabled}
                      checked={allowConfirmed.has(candidate.id)}
                      onChange={(event) =>
                        selectAllowConfirmed((previous) =>
                          toggleId(previous, candidate.id, event.target.checked),
                        )
                      }
                    />
                    Approve this correction to my confirmed properties after review.
                  </label>
                )}
              </>
            )}
            {candidate.kind === 'unknown' && <p>Choose an interpretation before acceptance.</p>}
            {candidate.kind === 'void' && (
              <p>Cuts a reviewed opening in a containing slab. Review the boundary carefully.</p>
            )}
            {candidate.kind === 'passage' && !candidate.wallId && (
              <p>
                Open circulation guide. The route stays open without adding a wall; choose a real host only if
                this is a framed opening.
              </p>
            )}
            {candidate.kind === 'stair' && (
              <p>
                Keep as a footprint guide, or choose a destination floor. A complete connection must fit its
                rise, footprint and upper slab.
              </p>
            )}
            <CandidateDetails candidate={candidate} walls={walls} disabled={disabled} update={update} />
          </article>
        ))}
      </div>
      <DesignReview designs={designs} selected={selectedDesigns} select={selectDesigns} disabled={disabled} />
    </details>
  )
}
