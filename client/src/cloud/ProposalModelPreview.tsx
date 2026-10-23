import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import type { Candidate } from '../../../api/src/contracts/analysis'
import type { DesignProposal } from '../../../api/src/contracts/design'
import type { Project, SourceDocument } from '../domain/types'
import { activeLevel } from '../domain/types'
import { convertProposal } from '../intelligence/convertProposal'
import { applyDesigns } from '../intelligence/designCompletion'
import { api } from './api'
import { createPortal } from 'react-dom'
import { useOverlay } from '../app/useOverlay'
type ServerRequest = {
  analysisId: string
  baseRevision: number
  candidateIds: string[]
  edits: Candidate[]
  allowConfirmedIds: string[]
  designIds: string[]
  replaceLevel: boolean
}
const Viewer = lazy(() => import('../rendering/Viewer').then((module) => ({ default: module.Viewer })))
export function ProposalModelPreview({
  project,
  levelId,
  source,
  candidates,
  designs,
  serverRequest,
  serverOnly,
  acceptedModel,
  apply,
  canApply,
  applying,
  applyError,
  onValidated,
  autoOpen = true,
}: {
  project: Project
  levelId: string
  source: SourceDocument
  candidates: Candidate[]
  designs: DesignProposal[]
  serverRequest?: ServerRequest
  serverOnly?: boolean
  acceptedModel?: Project
  apply?: () => Promise<boolean>
  canApply?: boolean
  applying?: boolean
  applyError?: string
  onValidated?: (valid: boolean) => void
  autoOpen?: boolean
}) {
  const [open, setOpen] = useState(Boolean(serverOnly && serverRequest && autoOpen)),
    [enhanced, setEnhanced] = useState(true),
    [roof, setRoof] = useState(!serverOnly || designs.length > 0)
  const dialog = useRef<HTMLElement>(null),
    trigger = useRef<HTMLButtonElement>(null)
  useOverlay(dialog, open, () => setOpen(false))
  const [serverModel, setServerModel] = useState<Project>(),
    [serverError, setServerError] = useState('')
  const requestKey = serverRequest ? JSON.stringify(serverRequest) : ''
  useEffect(() => {
    if (!open || !requestKey) return
    let alive = true
    setServerModel(undefined)
    setServerError('')
    onValidated?.(false)
    const request = JSON.parse(requestKey) as ServerRequest
    const { analysisId, ...body } = request
    api
      .request<{ document: Project }>(`/analysis/${analysisId}/preview`, 'POST', {
        ...body,
        operationId: `preview:${analysisId}`,
      })
      .then((result) => {
        if (alive) {
          setServerModel(result.document)
          onValidated?.(true)
        }
      })
      .catch((error) => {
        if (alive) {
          setServerError(error.message)
          onValidated?.(false)
        }
      })
    return () => {
      alive = false
    }
  }, [open, requestKey])
  const preview = useMemo(() => {
    const level = activeLevel(project, levelId)
    if (!open || !level.calibration || serverOnly) return { project, issue: '' }
    try {
      const input = {
        sourceAssetId: 'preview',
        sourceId: source.id,
        levelId,
        calibration: level.calibration,
        alignment: level.alignment,
        options: { mode: 'full' as const, complex: false, cloudConsent: true as const },
        deterministicCandidates: [],
      }
      const converted = candidates.length
        ? convertProposal(project, input, 'preview', candidates, source)
        : project
      return { project: designs.length ? applyDesigns(converted, levelId, designs) : converted, issue: '' }
    } catch (error) {
      return { project, issue: (error as Error).message }
    }
  }, [open, project, levelId, source, candidates, designs, serverOnly])
  const displayed = enhanced
    ? serverOnly
      ? acceptedModel || serverModel || project
      : preview.project
    : project
  const building = displayed.buildings.find((building) =>
    building.levels.some((level) => level.id === levelId),
  )!
  return (
    <>
      <button ref={trigger} onClick={() => setOpen(true)}>
        Compare current / proposed 3D
      </button>
      {open &&
        createPortal(
          <div className="cloud-modal">
            <section
              ref={dialog}
              className="cloud-dialog cloud-model-dialog"
              role="dialog"
              aria-modal="true"
              aria-label="Current and proposed model preview"
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.preventDefault()
                  event.stopPropagation()
                  setOpen(false)
                }
                if (event.key === 'Tab') {
                  const controls = [
                    ...dialog.current!.querySelectorAll<HTMLElement>(
                      'button:not(:disabled),input,select,[tabindex="0"]',
                    ),
                  ].filter((item) => item.getClientRects().length)
                  const first = controls[0],
                    last = controls.at(-1)
                  if (event.shiftKey && document.activeElement === first) {
                    event.preventDefault()
                    last?.focus()
                  }
                  if (!event.shiftKey && document.activeElement === last) {
                    event.preventDefault()
                    first?.focus()
                  }
                }
              }}
            >
              <header>
                <h2>Review the proposed model</h2>
                <button disabled={applying} onClick={() => setOpen(false)}>
                  Close preview
                </button>
              </header>
              <p>Preview only. Selecting this view does not save or accept any changes.</p>
              <nav>
                <button aria-pressed={!enhanced} onClick={() => setEnhanced(false)}>
                  Current model
                </button>
                <button aria-pressed={enhanced} onClick={() => setEnhanced(true)}>
                  Proposed model
                </button>
              </nav>
              {preview.issue && <p role="alert">Proposal needs correction: {preview.issue}</p>}
              {serverError && <p role="alert">Server model needs correction: {serverError}</p>}
              {applyError && <p role="alert">{applyError}</p>}
              {enhanced && serverRequest && !serverModel ? (
                <p role="status">
                  {serverError
                    ? 'Correct the selected geometry before previewing.'
                    : 'Server is compiling and validating the selected model…'}
                </p>
              ) : (
                <div className="cloud-model-canvas">
                  <Suspense fallback={<p>Loading 3D preview…</p>}>
                    <Viewer
                      building={building}
                      activeLevelId={levelId}
                      selection={null}
                      select={() => {}}
                      roofShown={roof}
                      setRoofShown={setRoof}
                      presentation
                    />
                  </Suspense>
                </div>
              )}
              {apply && (
                <button
                  className="primary"
                  disabled={!canApply || applying || Boolean(serverError) || (serverOnly && !serverModel)}
                  onClick={() =>
                    void apply().then((applied) => {
                      if (applied) setOpen(false)
                    })
                  }
                >
                  {applying ? 'Applying reconstruction…' : 'Apply reconstruction to this floor'}
                </button>
              )}
            </section>
          </div>,
          document.body,
        )}
    </>
  )
}
