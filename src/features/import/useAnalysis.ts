import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Calibration, Wall } from '../../domain/types'
import { uid } from '../../domain/types'
import { sourceToWorld } from '../../geometry/math'
import { estimateAutoScale, initialAutoScale } from '../../geometry/autoScale'
import type { ThinFeature } from '../../workers/thinFeatures'
import type { WorldFeature } from '../../geometry/openingCandidates'
import { findOpeningCandidates, type OpeningChoice } from '../../geometry/openingCandidates'

type Line = { x1: number; y1: number; x2: number; y2: number; thicknessPixels: number }
export type AnalysisStatus = 'idle' | 'preparing' | 'analyzing' | 'building' | 'completed' | 'failed'
export function useAnalysis() {
  const [status, setStatus] = useState<AnalysisStatus>('idle')
  const [candidates, setCandidates] = useState<Wall[]>([])
  const [features, setFeatures] = useState<WorldFeature[]>([])
  const [openingChoices, setOpeningChoices] = useState<Record<string, OpeningChoice>>({})
  const openings = useMemo(() => findOpeningCandidates(candidates, features).map(item =>
    ({ ...item, choice: openingChoices[item.id] || item.choice })), [candidates, features, openingChoices])
  const [error, setError] = useState('')
  const worker = useRef<Worker | null>(null)
  const generation = useRef(0)
  const abort = useRef<AbortController | null>(null)
  const clear = useCallback(() => {
    generation.current++
    abort.current?.abort(); abort.current = null
    worker.current?.terminate(); worker.current = null
    setCandidates([]); setFeatures([]); setOpeningChoices({}); setStatus('idle'); setError('')
  }, [])
  useEffect(() => () => { generation.current++; abort.current?.abort(); worker.current?.terminate() }, [])
  const analyze = useCallback(async (url: string, calibration: Calibration | undefined, sourceSize: { width: number; height: number },
    onAutoScale?: (estimate: Calibration) => void) => {
    const job = ++generation.current
    abort.current?.abort(); worker.current?.terminate(); worker.current = null
    abort.current = new AbortController()
    setStatus('preparing'); setError(''); setCandidates([]); setFeatures([]); setOpeningChoices({})
    try {
      const response = await fetch(url, { signal: abort.current.signal })
      const scale = Math.min(3000 / Math.max(sourceSize.width, sourceSize.height),
        Math.max(1, 600 / Math.min(sourceSize.width, sourceSize.height)))
      const bitmap = await createImageBitmap(await response.blob(), {
        resizeWidth: Math.max(1, Math.round(sourceSize.width * scale)),
        resizeHeight: Math.max(1, Math.round(sourceSize.height * scale)),
        resizeQuality: scale > 1 ? 'pixelated' : 'high',
      })
      if (job !== generation.current) { bitmap.close(); return }
      const canvas = document.createElement('canvas')
      canvas.width = bitmap.width; canvas.height = bitmap.height
      const context = canvas.getContext('2d', { willReadFrequently: true })!
      context.fillStyle = '#fff'
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
      bitmap.close()
      const data = context.getImageData(0, 0, canvas.width, canvas.height)
      const xScale = sourceSize.width / canvas.width, yScale = sourceSize.height / canvas.height
      canvas.width = 0; canvas.height = 0
      const activeWorker = new Worker(new URL('../../workers/analyze.ts', import.meta.url), { type: 'module' })
      worker.current = activeWorker
      setStatus('analyzing')
      activeWorker.onmessage = (event: MessageEvent<{ candidates?: Line[]; features?: ThinFeature[]; error?: string; stage?: 'building' }>) => {
        if (job !== generation.current) return
        if (event.data.stage === 'building') { setStatus('building'); return }
        if (event.data.error) {
          setError(`Plan analysis failed: ${event.data.error}`); setStatus('failed')
          activeWorker.terminate(); worker.current = null
          return
        }
        const lines = event.data.candidates || []
        const activeScale = calibration && calibration.method !== 'auto' ? calibration : lines.length
          ? estimateAutoScale(lines.map(line => ({ x1: line.x1 * xScale, y1: line.y1 * yScale,
            x2: line.x2 * xScale, y2: line.y2 * yScale, thicknessPixels: line.thicknessPixels * (line.y1 === line.y2 ? yScale : xScale) })), sourceSize.width, sourceSize.height)
          : calibration || initialAutoScale(sourceSize.width, sourceSize.height)
        if (activeScale.method === 'auto') onAutoScale?.(activeScale)
        const walls = lines.map(line => ({ id: uid('wall'), start: sourceToWorld({ x: line.x1 * xScale, z: line.y1 * yScale }, activeScale),
          end: sourceToWorld({ x: line.x2 * xScale, z: line.y2 * yScale }, activeScale),
          thickness: Math.max(.1, Math.min(1.2, line.thicknessPixels * (line.y1 === line.y2 ? yScale : xScale) * activeScale.metresPerPixel)), height: 2.9, material: 'plaster' as const }))
        setCandidates(walls)
        setFeatures((event.data.features || []).map(line => ({ kind: line.kind,
          start: sourceToWorld({ x: line.x1 * xScale, z: line.y1 * yScale }, activeScale),
          end: sourceToWorld({ x: line.x2 * xScale, z: line.y2 * yScale }, activeScale) })))
        setStatus('completed'); activeWorker.terminate(); worker.current = null
      }
      activeWorker.onerror = () => { if (job === generation.current) { setError('Plan analysis failed in the worker.'); setStatus('failed'); activeWorker.terminate(); worker.current = null } }
      activeWorker.postMessage({ pixels: data.data, width: data.width, height: data.height }, [data.data.buffer])
    } catch (cause) { if (job === generation.current) { setError((cause as Error).message); setStatus('failed') } }
  }, [])
  return useMemo(() => ({ status, candidates, setCandidates, openings, setOpeningChoices, clear, error, analyze }),
    [status, candidates, openings, clear, error, analyze])
}
