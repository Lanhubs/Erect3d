import { useState } from 'react'
import { FiArchive, FiChevronDown, FiFileText } from 'react-icons/fi'
import type { Project } from '../domain/types'
import { listProjects } from '../state/database'
import { createRemote } from './projectActions'
import './draftRecovery.css'
export function RecoverDrafts({ userId, open }: { userId: string; open: (id: string) => void }) {
  const [drafts, setDrafts] = useState<Project[]>([]),
    [checked, setChecked] = useState(false),
    [loading, setLoading] = useState(false),
    [recovering, setRecovering] = useState<string | null>(null),
    [error, setError] = useState('')
  const load = async () => {
    if (loading) return
    setLoading(true)
    setError('')
    try {
      setDrafts((await listProjects()).toSorted((a, b) => b.modified - a.modified))
      setChecked(true)
    } catch (error) {
      setError((error as Error).message)
    } finally {
      setLoading(false)
    }
  }
  return (
    <details
      className="draft-recovery"
      onToggle={(event) => {
        if (event.currentTarget.open && !checked) void load()
      }}
    >
      <summary>
        <FiArchive aria-hidden="true" />
        <span className="draft-recovery-heading">
          <strong>Recover device drafts</strong>
          <span>Bring an earlier design into your account</span>
        </span>
        {checked && <span className="draft-recovery-count">{drafts.length}</span>}
        <FiChevronDown className="draft-recovery-chevron" aria-hidden="true" />
      </summary>
      <div className="draft-recovery-content">
        <p className="draft-recovery-description">
          Choose a draft to continue in your account. The original stays on this device.
        </p>
        {loading && <p role="status">Looking for saved drafts…</p>}
        {!!drafts.length && (
          <ul className="draft-recovery-list">
            {drafts.map((project) => (
              <li className="draft-recovery-row" key={project.id}>
                <FiFileText aria-hidden="true" />
                <div className="draft-recovery-info">
                  <strong>{project.name || 'Untitled project'}</strong>
                  <span>
                    {Number.isFinite(new Date(project.modified).getTime()) && project.modified > 0 ? (
                      <>
                        Saved{' '}
                        <time dateTime={new Date(project.modified).toISOString()}>
                          {new Date(project.modified).toLocaleDateString(undefined, {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </time>
                      </>
                    ) : (
                      'Saved on this device'
                    )}
                  </span>
                </div>
                <button
                  aria-label={`Recover ${project.name || 'Untitled project'}`}
                  disabled={recovering !== null}
                  onClick={async () => {
                    if (recovering) return
                    setRecovering(project.id)
                    setError('')
                    try {
                      open(await createRemote(userId, project, `recover-${project.id}`, true))
                    } catch (error) {
                      setError((error as Error).message)
                    } finally {
                      setRecovering(null)
                    }
                  }}
                >
                  {recovering === project.id ? 'Recovering…' : 'Recover project'}
                </button>
              </li>
            ))}
          </ul>
        )}
        {checked && !loading && !drafts.length && (
          <p className="draft-recovery-empty">No previous drafts on this device.</p>
        )}
        {error && (
          <div className="draft-recovery-error" role="alert">
            <p>{error}</p>
            {!checked && (
              <button onClick={() => void load()} disabled={loading}>
                Try again
              </button>
            )}
          </div>
        )}
      </div>
    </details>
  )
}
