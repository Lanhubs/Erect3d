import type { SnackbarMessage } from '../utils/snackbar'
import { useSnackbar } from '../utils/useSnackbar'
import './snackbar.css'

interface SnackbarItemProps {
  message: SnackbarMessage
  onDismiss: (id: string) => void
}

function SnackbarItem({ message, onDismiss }: SnackbarItemProps) {
  const handleDismiss = () => {
    onDismiss(message.id)
  }

  return (
    <div 
      className={`snackbar-item snackbar-${message.variant}`}
      role="alert"
      aria-live={message.variant === 'error' ? 'assertive' : 'polite'}
    >
      <div className="snackbar-content">
        <div className="snackbar-message">{message.message}</div>
        {message.dismissible && (
          <button 
            className="snackbar-dismiss"
            onClick={handleDismiss}
            aria-label="Dismiss notification"
          >
            ×
          </button>
        )}
      </div>
    </div>
  )
}

interface SnackbarContainerProps {
  position?: 'top' | 'bottom'
}

export function SnackbarContainer({ position = 'bottom' }: SnackbarContainerProps) {
  const { messages, dismiss } = useSnackbar()

  if (messages.length === 0) {
    return null
  }

  return (
    <div className={`snackbar-container snackbar-${position}`}>
      {messages.map(message => (
        <SnackbarItem
          key={message.id}
          message={message}
          onDismiss={dismiss}
        />
      ))}
    </div>
  )
}
