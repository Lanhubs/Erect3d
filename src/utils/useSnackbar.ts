import { useEffect, useState, useCallback } from 'react'
import { snackbar, type SnackbarMessage, type SnackbarOptions } from './snackbar'

export function useSnackbar() {
  const [messages, setMessages] = useState<SnackbarMessage[]>(() => snackbar.getMessages())

  useEffect(() => {
    const unsubscribe = snackbar.subscribe(setMessages)
    return unsubscribe
  }, [])

  const success = useCallback((message: string, options?: Partial<SnackbarOptions>) => {
    return snackbar.success(message, options)
  }, [])

  const error = useCallback((message: string, options?: Partial<SnackbarOptions>) => {
    return snackbar.error(message, options)
  }, [])

  const warning = useCallback((message: string, options?: Partial<SnackbarOptions>) => {
    return snackbar.warning(message, options)
  }, [])

  const info = useCallback((message: string, options?: Partial<SnackbarOptions>) => {
    return snackbar.info(message, options)
  }, [])

  const dismiss = useCallback((id: string) => {
    snackbar.dismiss(id)
  }, [])

  const dismissAll = useCallback(() => {
    snackbar.dismissAll()
  }, [])

  // API-specific helpers
  const apiError = useCallback((error: string | Error, context?: string) => {
    return snackbar.apiError(error, context)
  }, [])

  const apiSuccess = useCallback((message: string, action?: string) => {
    return snackbar.apiSuccess(message, action)
  }, [])

  const saveSuccess = useCallback((itemName?: string) => {
    return snackbar.saveSuccess(itemName)
  }, [])

  const deleteSuccess = useCallback((itemName?: string) => {
    return snackbar.deleteSuccess(itemName)
  }, [])

  const loadingError = useCallback((itemName?: string) => {
    return snackbar.loadingError(itemName)
  }, [])

  const validationError = useCallback((field: string, requirement: string) => {
    return snackbar.validationError(field, requirement)
  }, [])

  const networkError = useCallback(() => {
    return snackbar.networkError()
  }, [])

  return {
    messages,
    success,
    error,
    warning,
    info,
    dismiss,
    dismissAll,
    // API helpers
    apiError,
    apiSuccess,
    saveSuccess,
    deleteSuccess,
    loadingError,
    validationError,
    networkError
  }
}
