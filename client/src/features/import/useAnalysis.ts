import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Calibration, Wall } from '../../domain/types'
import type { PlanDetail } from '../../domain/interpretationTypes'
import type { PlanAnalysisResult } from '../../workers/analyze'
import { worldInterpretation } from '../../geometry/planInterpretation'
import { enclosedSpaces } from '../../geometry/roomTopology'
import { assembleDraft } from '../../geometry/reconstruct'
import type { WorldFeature } from '../../geometry/openingCandidates'
import { findOpeningCandidates, type OpeningChoice } from '../../geometry/openingCandidates'
import { publishLocalEvidence } from '../../cloud/localEvidence'

export type AnalysisStatus = 'idle' | 'preparing' | 'analyzing' | 'building' | 'completed' | 'failed'
export function useAnalysis() {
  const [status, setStatus] = useState<AnalysisStatus>('idle')
  const [candidates, setCandidates] = useState<Wall[]>([])
  const [features, setFeatures] = useState<WorldFeature[]>([])
  const [details, setDetails] = useState<PlanDetail[]>([])
  const [detailChoices, setDetailChoices] = useState<Record<string, boolean>>({})
  const [report, setReport] = useState<PlanAnalysisResult['report'] | null>(null)
  const [openingChoices, setOpeningChoices] = useState<Record<string, OpeningChoice>>({})
  const [spaceChoices, setSpaceChoices] = useState<Record<string, boolean>>({})
  const [selectedSpace, setSelectedSpace] = useState<string | null>(null)
  const openings = useMemo(() => findOpeningCandidates(candidates, features).map(item =>
    ({ ...item, choice: openingChoices[item.id] || item.choice })), [candidates, features, openingChoices])
  const rooms = useMemo(() => enclosedSpaces(assembleDraft(candidates, openings.map(item =>
    item.choice === 'unknown' ? { ...item, choice: 'wall' as const } : item)).walls), [candidates, openings])
  const [error, setError] = useState('')
  const worker = useRef<Worker | null>(null)
  const generation = useRef(0)
  const abort = useRef<AbortController | null>(null)
  const clear = useCallback(() => {
    generation.current++
    abort.current?.abort(); abort.current = null
    worker.current?.terminate(); worker.current = null
    setCandidates([]); setFeatures([]); setDetails([]); setDetailChoices({}); setReport(null); setOpeningChoices({}); setStatus('idle'); setError('')
    setSpaceChoices({}); setSelectedSpace(null)
  }, [])
  useEffect(() => () => { generation.current++; abort.current?.abort(); worker.current?.terminate() }, [])
  const analyze = useCallback(async (url: string, calibration: Calibration | undefined, sourceSize: { width: number; height: number; id?: string },
    onAutoScale?: (estimate: Calibration) => void) => {
    const job = ++generation.current
    abort.current?.abort(); worker.current?.terminate(); worker.current = null
    abort.current = new AbortController()
    setStatus('preparing'); setError(''); setCandidates([]); setFeatures([]); setDetails([]); setDetailChoices({}); setReport(null); setOpeningChoices({})
    setSpaceChoices({}); setSelectedSpace(null)
    try {
      const response = await fetch(url, { signal: abort.current.signal })
      const bitmap = await createImageBitmap(await response.blob())
      if (job !== generation.current) { bitmap.close(); return }
      const canvas = document.createElement('canvas')
      canvas.width = bitmap.width; canvas.height = bitmap.height
      const context = canvas.getContext('2d', { willReadFrequently: true })!
      context.fillStyle = '#fff'
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
      bitmap.close()
      const data = context.getImageData(0, 0, canvas.width, canvas.height)
      canvas.width = 0; canvas.height = 0
      const activeWorker = new Worker(new URL('../../workers/analyze.ts', import.meta.url), { type: 'module' })
      worker.current = activeWorker
      setStatus('analyzing')
      return await new Promise<ReturnType<typeof worldInterpretation> | undefined>(resolve => {
      const signal = abort.current!.signal
      const cancelled = () => resolve(undefined)
      signal.addEventListener('abort', cancelled, { once: true })
      const finish = (result?: ReturnType<typeof worldInterpretation>) => { signal.removeEventListener('abort', cancelled); resolve(result) }
      activeWorker.onmessage = (event: MessageEvent<PlanAnalysisResult & { error?: string; stage?: 'building' }>) => {
        if (job !== generation.current) return
        if (event.data.stage === 'building') { setStatus('building'); return }
        if (event.data.error) {
          setError(`Plan analysis failed: ${event.data.error}`); setStatus('failed')
          activeWorker.terminate(); worker.current = null; finish()
          return
        }
        const result = worldInterpretation(event.data, sourceSize, calibration)
        if (sourceSize.id) publishLocalEvidence(sourceSize.id, sourceSize, result.calibration, result.walls, result.features, result.details)
        if (result.calibration.method === 'auto') onAutoScale?.(result.calibration)
        setCandidates(result.walls); setFeatures(result.features); setDetails(result.details); setReport(result.report)
        setDetailChoices(Object.fromEntries(result.details.map(detail => [detail.id, detail.kind === 'stair'])))
        setStatus('completed'); activeWorker.terminate(); worker.current = null; finish(result)
      }
      activeWorker.onerror = () => { if (job === generation.current) { setError('Plan analysis failed in the worker.'); setStatus('failed'); activeWorker.terminate(); worker.current = null; finish() } }
      activeWorker.postMessage({ pixels: data.data, width: data.width, height: data.height }, [data.data.buffer])
      })
    } catch (cause) { if (job === generation.current) { setError((cause as Error).message); setStatus('failed') } }
  }, [])
  return useMemo(() => ({ status, candidates, setCandidates, openings, setOpeningChoices, rooms, spaceChoices, setSpaceChoices, selectedSpace, setSelectedSpace,
    details, detailChoices, setDetailChoices, report, clear, error, analyze }),
    [status, candidates, openings, rooms, spaceChoices, selectedSpace, details, detailChoices, report, clear, error, analyze])
}
