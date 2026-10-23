import { useRef, useState } from 'react'
import { useOverlay } from './useOverlay'
export type WorkspaceCommand = {
  id: string
  label: string
  keywords?: string
  run: () => void
  disabled?: boolean
}
export function CommandSearch({ commands, close }: { commands: WorkspaceCommand[]; close: () => void }) {
  const ref = useRef<HTMLDivElement>(null),
    [query, setQuery] = useState('')
  useOverlay(ref, true, close)
  const found = commands.filter((command) =>
    `${command.label} ${command.keywords || ''}`.toLowerCase().includes(query.toLowerCase()),
  )
  return (
    <div
      className="command-backdrop"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) close()
      }}
    >
      <div className="command-search" role="dialog" aria-modal="true" aria-label="Find a control" ref={ref}>
        <input
          aria-label="Search controls"
          placeholder="Find a tool or control…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault()
              ref.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus()
            }
          }}
        />
        <div
          onKeyDown={(event) => {
            if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
            event.preventDefault()
            const items = [
                ...event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'),
              ],
              index = items.indexOf(document.activeElement as HTMLButtonElement)
            items[
              event.key === 'Home'
                ? 0
                : event.key === 'End'
                  ? items.length - 1
                  : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
            ]?.focus()
          }}
        >
          {found.map((command) => (
            <button
              disabled={command.disabled}
              key={command.id}
              onClick={() => {
                close()
                command.run()
              }}
            >
              <span>{command.label}</span>
              <small>{command.keywords}</small>
            </button>
          ))}
          {!found.length && <p>No matching controls. Try “roof”, “stairs” or “source”.</p>}
        </div>
        <footer>↑ ↓ / Tab to browse · Enter to choose · Esc to close</footer>
      </div>
    </div>
  )
}
