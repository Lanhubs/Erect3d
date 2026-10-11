import { useCallback, useEffect, useRef, useState } from 'react'
import type { Calibration, Level, SourceDocument } from '../domain/types'
import type { FurnitureCandidate } from './types'
import { useFurnitureReview } from './reviewState'
export const furnitureSourceKey = (level: Level, source?: SourceDocument) => `${level.id}:${source?.id || ''}`
export function useFurnitureAnalysis(level: Level, levels: Level[], source?: SourceDocument, url?: string, calibration?: Calibration) {
  const key = furnitureSourceKey(level, source)
  const contextKey = `${key}:${calibration?.metresPerPixel}:${level.alignment?.x}:${level.alignment?.z}`
  const [progress, setProgress] = useState({ key: contextKey, busy: false, message: '' })
  const session = useRef({ generation: 0, worker: null as Worker | null, abort: null as AbortController | null })
  useEffect(() => {
    const active = session.current
    const stop = () => { active.generation++; active.abort?.abort(); active.worker?.terminate(); active.worker = null }
    stop(); useFurnitureReview.getState().clear()
    return stop
  }, [contextKey])
  const cancel = useCallback(() => {
    const active = session.current; active.generation++; active.abort?.abort(); active.worker?.terminate(); active.worker = null
    setProgress({ key: contextKey, busy: false, message: '' })
  }, [contextKey])
  const analyze = useCallback(async () => {
    const report = (busy: boolean, message: string) => setProgress({ key: contextKey, busy, message })
    if (!url || !source || !calibration) { report(false, 'Import and scale a source plan first.'); return }
    if (!level.rooms.length && !level.slabs?.length) { report(false, 'Analyze and review the building outline first.'); return }
    const active = session.current, job = ++active.generation
    active.abort?.abort(); active.worker?.terminate(); active.abort = new AbortController()
    report(true, 'Finding furniture symbols…')
    try {
      const response = await fetch(url, { signal: active.abort.signal })
      if (!response.ok) throw new Error('The source plan could not be loaded.')
      const scale = Math.min(1, 1600 / Math.max(source.width, source.height))
      const bitmap = await createImageBitmap(await response.blob(), { resizeWidth: Math.max(1, Math.round(source.width * scale)), resizeHeight: Math.max(1, Math.round(source.height * scale)) })
      if (job !== active.generation) { bitmap.close(); return }
      const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height
      const context = canvas.getContext('2d', { willReadFrequently: true })!
      context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(bitmap, 0, 0); bitmap.close()
      const data = context.getImageData(0, 0, canvas.width, canvas.height); canvas.width = 0; canvas.height = 0
      const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' }); active.worker = worker
      worker.onmessage = (event: MessageEvent<{ candidates?: FurnitureCandidate[]; error?: string }>) => {
        if (job !== active.generation) return
        if (event.data.error) report(false, event.data.error)
        else { const candidates = event.data.candidates || []; useFurnitureReview.getState().begin(key, candidates)
          report(false, candidates.length ? `${candidates.length} proposals. Review before placement.` : 'No supported furniture symbols found. You can place furniture manually.') }
        worker.terminate(); active.worker = null
      }
      worker.onerror = () => { if (job === active.generation) { report(false, 'Furniture analysis failed. Your building is unchanged.'); worker.terminate(); active.worker = null } }
      worker.postMessage({ pixels: data.data, width: data.width, height: data.height, sourceWidth: source.width, calibration, level, levels, sourceId: source.id }, [data.data.buffer])
    } catch (cause) { if (job === active.generation) report(false, (cause as Error).message) }
  }, [url, source, calibration, level, levels, key, contextKey])
  return { analyze, cancel, busy: progress.key === contextKey && progress.busy, message: progress.key === contextKey ? progress.message : '' }
}
