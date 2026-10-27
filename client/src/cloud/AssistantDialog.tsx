import { useEffect, useRef, useState } from 'react'
import { useOverlay } from '../app/useOverlay'
import type { useAssistant } from './useAssistant'
import './assistant.css'
import { FiArrowLeft, FiArrowRight } from 'react-icons/fi'
export type AssistantState = ReturnType<typeof useAssistant>
export function AssistantDialog({
  assistant: a,
  open,
  close,
  preview,
}: {
  assistant: AssistantState
  open: boolean
  close: () => void
  preview: () => void
}) {
  const ref = useRef<HTMLElement>(null),
    end = useRef<HTMLDivElement>(null),
    [sheet, setSheet] = useState(() => matchMedia('(max-width:700px)').matches)
  const [left, setLeft] = useState(false)
  useOverlay(ref, open, close, true, sheet)
  useEffect(() => {
    const media = matchMedia('(max-width:700px)'),
      change = () => setSheet(media.matches)
    media.addEventListener('change', change)
    return () => media.removeEventListener('change', change)
  }, [])
  useEffect(() => {
    if (open) end.current?.scrollIntoView({ block: 'nearest' })
  }, [open, a.thread.messages.length, a.thread.run?.progress])
  const run = a.thread.run,
    ready = run?.status === 'ready' && run.proposal && !a.stale
  return (
    <section
      ref={ref}
      hidden={!open}
      className={`assistant-dialog${!a.thread.messages.length && !run ? ' assistant-intro' : ''}${left ? ' assistant-left' : ''}`}
      role="dialog"
      aria-modal={sheet || undefined}
      aria-label="Design assistant"
    >
      <header>
        <div>
          <h2>Design assistant</h2>
          <span>Describe a change to your building.</span>
        </div>
        <div className="assistant-window-actions">
          <button
            className="assistant-position"
            aria-label={left ? 'Move assistant right' : 'Move assistant left'}
            title={left ? 'Move assistant right' : 'Move assistant left'}
            onClick={() => setLeft(!left)}
          >
            {left ? <FiArrowRight /> : <FiArrowLeft />}
          </button>
          <button aria-label="Close assistant" title="Close assistant" onClick={close}>
            ×
          </button>
        </div>
      </header>
      <div className="assistant-conversation" role="log" aria-label="Conversation">
        <div className="assistant-conversation-btns">
          {a.thread.nextCursor && (
            <button disabled={a.busy} onClick={() => void a.older()}>
              Earlier messages
            </button>
          )}
          {!a.thread.messages.length && (
            <div className="assistant-empty">
              <h3>What would you like to improve?</h3>
              <p>
                Choose part of the model and describe the result you want. You can review every change before
                applying it.
              </p>
              <button
                onClick={() =>
                  a.setDraft(
                    'Review this floor and propose corrections to any misplaced furniture or disconnected openings.',
                  )
                }
              >
                Review this floor
              </button>
              <button
                onClick={() =>
                  a.setDraft(
                    'Suggest a coordinated roof design that fits this building and preserves its courtyards.',
                  )
                }
              >
                Improve the roof
              </button>
            </div>
          )}
        </div>
        {a.thread.messages.map((message) => (
          <article key={message.id} className={`assistant-message ${message.role}`}>
            <small>{message.role === 'user' ? 'You' : 'Assistant'}</small>
            <p>{message.content}</p>
          </article>
        ))}
        {run && (
          <section className="assistant-run" aria-label="Request progress">
            <p role="status">
              {a.stale ? 'The model changed. Send a new request to update this proposal.' : run.progress}
            </p>
            {a.pending && (
              <div>
                <button disabled={a.busy || !a.online} onClick={() => void a.cancel()}>
                  Cancel request
                </button>
                <button disabled={a.busy || !a.online} onClick={() => void a.refresh()}>
                  Check status
                </button>
              </div>
            )}
            {ready && (
              <>
                <p className="assistant-proposal-note">Nothing has been applied.</p>
                <div className="assistant-proposal-actions">
                  <button className="primary" onClick={preview}>
                    Preview changes
                  </button>
                  <button disabled={a.busy || !a.online} onClick={() => void a.cancel()}>
                    Discard
                  </button>
                </div>
              </>
            )}
            {run.status === 'applied' && (
              <p>Changes are saved to the model. Use Undo to restore the previous version.</p>
            )}
            {run.status === 'failed' && (
              <button
                disabled={a.busy || !a.online}
                onClick={() => {
                  const message = a.thread.messages.findLast((message) => message.role === 'user')
                  if (message) a.setDraft(message.content)
                }}
              >
                Edit and retry
              </button>
            )}
          </section>
        )}
        <div ref={end} />
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          void a.send()
        }}
      >
        <div className="assistant-scope" aria-label="Change scope">
          {(['selection', 'level', 'building'] as const).map((mode, i) => (
            <button
              key={mode}
              type="button"
              disabled={a.pending}
              aria-pressed={a.scope?.mode === mode}
              onClick={() => a.chooseScope(mode)}
            >
              {['Selection', 'This floor', 'Whole building'][i]}
            </button>
          ))}
        </div>
        <p className="assistant-context">
          {a.scope?.mode === 'building' ? a.building?.name : a.level?.name}
          {a.scope?.mode === 'selection' ? ' · selected element' : ''}
          {a.targetFromMessage ? ' · from your message' : ''}
        </p>
        {a.level?.sourceId && (
          <label className="assistant-reference">
            <input
              type="checkbox"
              checked={a.attach}
              disabled={a.pending}
              onChange={(e) => a.setAttach(e.target.checked)}
            />
            Use {a.referenceName} as a reference
          </label>
        )}
        <label className="sr-only" htmlFor="assistant-message">
          Describe a change
        </label>
        <textarea
          id="assistant-message"
          aria-label="Describe a change"
          placeholder="Describe what you want to change…"
          maxLength={8000}
          rows={3}
          value={a.draft}
          disabled={a.pending}
          onChange={(e) => a.setDraft(e.target.value)}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
              e.preventDefault()
              if (!a.pending && !a.busy) void a.send()
            }
          }}
        />
        {a.error && (
          <p role="alert" className="assistant-error">
            {a.error}
          </p>
        )}
        {!a.online && (
          <p className="assistant-note">
            Offline. Your conversation and draft are kept on this device. Manual editing remains available.
          </p>
        )}
        {a.enabled === false && (
          <p className="assistant-note">The assistant has not been configured on this server.</p>
        )}
        {a.readOnly && <p className="assistant-note">Editing access is required to request changes.</p>}
        <footer>
          <span>Preview before applying · Ctrl / ⌘ Enter to send</span>
          <button
            className="primary"
            disabled={
              a.busy || a.pending || !a.draft.trim() || !a.online || a.readOnly || a.enabled === false
            }
          >
            {a.busy ? 'Working…' : 'Send'}
          </button>
        </footer>
      </form>
    </section>
  )
}
export function AssistantPreviewBar({
  assistant: a,
  proposed,
  toggle,
  close,
  chat,
}: {
  assistant: AssistantState
  proposed: boolean
  toggle: (next: boolean) => void
  close: () => void
  chat: () => void
}) {
  const ref = useRef<HTMLElement>(null)
  useOverlay(ref, true, close, true, false)
  return (
    <section ref={ref} className="assistant-preview-bar" aria-label="Proposal preview">
      <strong>Preview only</strong>
      <div>
        <button aria-pressed={!proposed} onClick={() => toggle(false)}>
          Current
        </button>
        <button aria-pressed={proposed} onClick={() => toggle(true)}>
          Proposed
        </button>
      </div>
      <button
        className="primary"
        disabled={a.busy || a.stale || !a.online || a.readOnly}
        onClick={() => {
          close()
          chat()
          void a.apply()
        }}
      >
        Apply
      </button>
      <button
        disabled={a.busy}
        onClick={() => {
          close()
          chat()
          void a.cancel()
        }}
      >
        Discard
      </button>
      <button
        onClick={() => {
          close()
          chat()
        }}
      >
        Continue conversation
      </button>
      <button aria-label="Close proposal preview" onClick={close}>
        ×
      </button>
    </section>
  )
}
