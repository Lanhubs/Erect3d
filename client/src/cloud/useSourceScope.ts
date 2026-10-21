import { useEffect, useRef } from 'react'
import { currentReconstructionSource, type ReconstructionContext } from './reconstructionContext'

// SourcePanel is keyed by source and floor. Check the live document as well as
// mounting: a source can change before React runs an effect's cleanup.
export function useSourceScope(context: ReconstructionContext) {
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  const current = () => alive.current && currentReconstructionSource(context)
  const assertCurrent = () => { if (!current()) throw new Error('The floor plan changed. Reconstruct the current source.') }
  return { current, assertCurrent }
}
