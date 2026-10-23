export type ConfirmationOptions = {
  title: string
  message: string
  label?: string
  item?: string
  destructive?: boolean
  onConfirm?: () => Promise<unknown>
}

let nextId = 0

/** One request owns its completion, even if another overlay replaces it. */
export function confirmationRequest(options: ConfirmationOptions, resolve: (value: boolean) => void) {
  let settled = false,
    pending = false
  const finish = (value: boolean) => {
    if (!settled) {
      settled = true
      resolve(value)
    }
  }
  return {
    id: ++nextId,
    options,
    cancel() {
      if (!pending) finish(false)
    },
    async accept() {
      if (settled || pending) return false
      pending = true
      try {
        await options.onConfirm?.()
        finish(true)
        return true
      } finally {
        pending = false
      }
    },
  }
}
