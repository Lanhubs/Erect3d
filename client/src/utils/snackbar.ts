export type SnackbarVariant = 'success' | 'error' | 'warning' | 'info'

export interface SnackbarMessage {
  id: string
  message: string
  variant: SnackbarVariant
  duration?: number
  dismissible?: boolean
}

export interface SnackbarOptions {
  duration?: number
  dismissible?: boolean
  position?: 'top' | 'bottom'
  maxVisible?: number
}

export class SnackbarHelper {
  private messages: SnackbarMessage[] = []
  private listeners: ((messages: SnackbarMessage[]) => void)[] = []
  private options: Required<SnackbarOptions>

  constructor(options: SnackbarOptions = {}) {
    this.options = {
      duration: 5000,
      dismissible: true,
      position: 'bottom',
      maxVisible: 3,
      ...options
    }
  }

  // Core method to show messages
  private show(message: string, variant: SnackbarVariant, options?: Partial<SnackbarOptions>) {
    const id = `snackbar-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const snackbar: SnackbarMessage = {
      id,
      message,
      variant,
      duration: options?.duration ?? this.options.duration,
      dismissible: options?.dismissible ?? this.options.dismissible
    }

    this.messages.push(snackbar)

    // Limit visible messages
    if (this.messages.length > this.options.maxVisible) {
      this.messages = this.messages.slice(-this.options.maxVisible)
    }

    this.notifyListeners()

    // Auto-dismiss if duration is set
    if (snackbar.duration && snackbar.duration > 0) {
      setTimeout(() => this.dismiss(id), snackbar.duration)
    }

    return id
  }

  // Variant-specific methods
  success(message: string, options?: Partial<SnackbarOptions>) {
    return this.show(message, 'success', options)
  }

  error(message: string, options?: Partial<SnackbarOptions>) {
    return this.show(message, 'error', { 
      duration: options?.duration ?? 8000, // Errors stay longer by default
      ...options 
    })
  }

  warning(message: string, options?: Partial<SnackbarOptions>) {
    return this.show(message, 'warning', options)
  }

  info(message: string, options?: Partial<SnackbarOptions>) {
    return this.show(message, 'info', options)
  }

  // Specialized methods for common use cases
  apiError(error: string | Error, context?: string) {
    const message = error instanceof Error ? error.message : error
    const fullMessage = context ? `${context}: ${message}` : message
    return this.error(fullMessage)
  }

  apiSuccess(message: string, action?: string) {
    const fullMessage = action ? `${action} ${message}` : message
    return this.success(fullMessage)
  }

  saveSuccess(itemName?: string) {
    const message = itemName ? `${itemName} saved successfully` : 'Saved successfully'
    return this.success(message, { duration: 3000 })
  }

  deleteSuccess(itemName?: string) {
    const message = itemName ? `${itemName} deleted successfully` : 'Deleted successfully'
    return this.success(message, { duration: 3000 })
  }

  loadingError(itemName?: string) {
    const message = itemName ? `Failed to load ${itemName}` : 'Failed to load data'
    return this.error(message)
  }

  validationError(field: string, requirement: string) {
    return this.error(`${field}: ${requirement}`)
  }

  networkError() {
    return this.error('Network connection error. Please check your connection and try again.')
  }

  // Management methods
  dismiss(id: string) {
    this.messages = this.messages.filter(msg => msg.id !== id)
    this.notifyListeners()
  }

  dismissAll() {
    this.messages = []
    this.notifyListeners()
  }

  // Subscription methods for React components
  subscribe(listener: (messages: SnackbarMessage[]) => void) {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener)
    }
  }

  getMessages() {
    return [...this.messages]
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener([...this.messages]))
  }

  // Update global options
  updateOptions(options: Partial<SnackbarOptions>) {
    this.options = { ...this.options, ...options }
  }
}

// Create singleton instance
export const snackbar = new SnackbarHelper()

// Convenience exports for direct usage
export const showSuccess = (message: string, options?: Partial<SnackbarOptions>) => 
  snackbar.success(message, options)

export const showError = (message: string, options?: Partial<SnackbarOptions>) => 
  snackbar.error(message, options)

export const showWarning = (message: string, options?: Partial<SnackbarOptions>) => 
  snackbar.warning(message, options)

export const showInfo = (message: string, options?: Partial<SnackbarOptions>) => 
  snackbar.info(message, options)

// API-specific helpers that preserve existing response handling
export const showApiError = (error: string | Error, context?: string) => 
  snackbar.apiError(error, context)

export const showApiSuccess = (message: string, action?: string) => 
  snackbar.apiSuccess(message, action)