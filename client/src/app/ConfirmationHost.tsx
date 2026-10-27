import { useEffect, useRef, useState } from 'react'
import { create } from 'zustand'
import { useOverlay } from './useOverlay'
import { activateOverlay, releaseOverlay } from './overlayCoordinator'
import { confirmationRequest, type ConfirmationOptions } from './confirmationRequest'
import { floatingMenus, installMenuDismissal } from './menuDismissal'
type Confirmation = ReturnType<typeof confirmationRequest>
const useConfirmation = create<{ value: Confirmation | null }>(() => ({ value: null }))
export function confirmAction(message: string | ConfirmationOptions, label = 'Confirm') {
  useConfirmation.getState().value?.cancel()
  const options = typeof message === 'string' ? { title: label, message, label } : message
  return new Promise<boolean>((resolve) =>
    useConfirmation.setState({ value: confirmationRequest(options, resolve) }),
  )
}
function Confirmation({ value }: { value: Confirmation }) {
  const [pending, setPending] = useState(false),
    [error, setError] = useState('')
  const ref = useRef<HTMLDivElement>(null),
    clear = () => {
      if (useConfirmation.getState().value === value) useConfirmation.setState({ value: null })
    }
  const close = () => {
      value.cancel()
      clear()
    },
    options = value.options
  const accept = async () => {
    setPending(true)
    setError('')
    try {
      if (await value.accept()) clear()
    } catch (error) {
      setError((error as Error).message)
    } finally {
      setPending(false)
    }
  }
  useOverlay(ref, true, close)
  return (
    <div
      className="confirmation-backdrop "
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) close()
      }}
    >
      <div
        ref={ref}
        className="confirmation-dialog"
        role="dialog"
        aria-modal="true"
        aria-busy={pending}
        aria-labelledby="confirmation-heading"
        aria-describedby={`${options.item ? 'confirmation-item ' : ''}confirmation-description`}
        tabIndex={-1}
      >
        <h2 id="confirmation-heading">{options.title}</h2>
        {options.item && (
          <strong className="confirmation-item" id="confirmation-item">
            {options.item}
          </strong>
        )}
        <p id="confirmation-description">{options.message}</p>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <footer>
          <button disabled={pending} onClick={close}>
            Cancel
          </button>
          <button
            disabled={pending}
            className={options.destructive ? 'destructive' : 'primary'}
            onClick={() => void accept()}
          >
            {pending ? 'Please wait…' : options.label || 'Confirm'}
          </button>
        </footer>
      </div>
    </div>
  )
}
export function ConfirmationHost() {
  const value = useConfirmation((s) => s.value)
  useEffect(() => {
    const owners = new WeakMap<HTMLDetailsElement, symbol>()
    const toggle = (event: Event) => {
      const menu = event.target
      if (!(menu instanceof HTMLDetailsElement) || !menu.matches(floatingMenus)) return
      const id = owners.get(menu) || Symbol()
      owners.set(menu, id)
      if (menu.open)
        activateOverlay(id, () => {
          menu.open = false
        })
      else releaseOverlay(id)
    }
    document.addEventListener('toggle', toggle, true)
    const stop = installMenuDismissal(document)
    return () => {
      stop()
      document.removeEventListener('toggle', toggle, true)
    }
  }, [])
  return value ? <Confirmation value={value} key={value.id} /> : null
}
