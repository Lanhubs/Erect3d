import type { SourceDocument } from '../domain/types'
import { isCadMime, isPdfMime } from '../domain/sourceMime'
import type { CadStage } from '../features/import/cadTransfer'

const stageLabel: Record<CadStage, string> = {
  uploading: 'Uploading the drawing…',
  converting: 'Converting the drawing…',
  downloading: 'Loading the converted plan…',
}

export function SourceNotice({
  source,
  error,
  analysisError,
  busy,
  stage,
  pages,
  page,
  setPage,
  selectPage,
  onLoaded,
}: {
  source?: SourceDocument
  error: string
  analysisError: string
  busy: boolean
  stage: CadStage | ''
  pages: number
  page: number
  setPage: (page: number) => void
  selectPage: (page: number) => Promise<boolean>
  onLoaded: () => void
}) {
  return (
    <>
      {error && <div className="inline-error">{error}</div>}
      {busy && <div className="inline-note">{stage ? stageLabel[stage] : 'Preparing source document…'}</div>}
      {source && (source.width < 300 || source.height < 300) && (
        <div className="inline-note">
          Low-resolution plan: automatic analysis may miss fine details. You can edit the result in 2D.
        </div>
      )}
      {source && isCadMime(source.mime) && (
        <div className="inline-note">
          {source.metresPerPixel ? (
            <>
              Converted from a {source.units || 'unitless'} drawing. Scale is locked to the drawing units at
              {' 1 px ≈ '}
              {source.metresPerPixel.toPrecision(3)} m, so analysis keeps real dimensions.
            </>
          ) : (
            <>
              The drawing did not declare its units, so this plan uses the automatic scale. Confirm the scale
              below before analysing.
            </>
          )}
        </div>
      )}
      {pages > 1 && isPdfMime(source?.mime || '') && (
        <div className="page-choice">
          PDF page{' '}
          <input
            type="number"
            min="1"
            max={pages}
            value={page}
            onChange={(event) => setPage(Number(event.target.value))}
          />
          <span>of {pages}</span>
          <button
            onClick={async () => {
              if (await selectPage(page)) onLoaded()
            }}
          >
            Load page
          </button>
        </div>
      )}
      {analysisError && <div className="inline-error">{analysisError}</div>}
    </>
  )
}
