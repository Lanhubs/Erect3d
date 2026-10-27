export function textTileOffsets(length: number, edge: number) {
  if (length <= edge) return [0]
  const count = Math.ceil((length - edge) / (edge - 64)) + 1
  return Array.from({ length: count }, (_, index) => Math.min(length - edge, index * (edge - 64)))
}
export function textDeadline<T>(task: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const aborted = () => reject(signal.reason || new Error('OCR cancelled'))
    void task.then(resolve, reject).finally(() => signal.removeEventListener('abort', aborted))
    if (signal.aborted) return aborted()
    signal.addEventListener('abort', aborted, { once: true })
  })
}
