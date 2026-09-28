import type { SourceDocument } from '../domain/types'

export function SourceNotice({ source, error, analysisError, busy, pages, page, setPage, selectPage, onLoaded }: {
  source?: SourceDocument; error: string; analysisError: string; busy: boolean; pages: number; page: number;
  setPage: (page: number) => void; selectPage: (page: number) => Promise<boolean>; onLoaded: () => void
}) {
  return <>
    {error && <div className="inline-error">{error}</div>}
    {busy && <div className="inline-note">Preparing source document…</div>}
    {source && (source.width < 300 || source.height < 300) &&
      <div className="inline-note">Low-resolution plan: automatic analysis may miss fine details. You can edit the result in 2D.</div>}
    {pages > 1 && source?.mime === 'application/pdf' && <div className="page-choice">
      PDF page <input type="number" min="1" max={pages} value={page} onChange={event => setPage(Number(event.target.value))} />
      <span>of {pages}</span><button onClick={async () => { if (await selectPage(page)) onLoaded() }}>Load page</button>
    </div>}
    {analysisError && <div className="inline-error">{analysisError}</div>}
  </>
}
