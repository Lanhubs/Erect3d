import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { drawWalkMap } from './walkMap'
import { supportsWebgl } from './graphicsRenderer'
import type { Level, Selection } from '../domain/types'
import type { WalkOptions, WalkViewpoint } from '../walkthrough/types'

/** Walkthrough state: controller mode, options, minimap host and the entry request from the header. */
export function useWalkSession({
  onWalkChange,
  selection,
  setSectionHeight,
  setVerticalSection,
  walkRequest = 0,
}: {
  onWalkChange?: (walking: boolean) => void
  selection: Selection
  setSectionHeight: (value: number | null) => void
  setVerticalSection: (value: number | null) => void
  walkRequest?: number
}) {
  const [walk, setWalk] = useState(false),
    [lockedWalk, setLockedWalk] = useState(false),
    [dragWalk, setDragWalk] = useState(false)
  const [walkOptions, setWalkOptions] = useState<WalkOptions>({ speed: 'normal', start: 'entrance' }),
    [walkLevel, setWalkLevel] = useState('')
  const [error, setError] = useState('')
  const [webglAvailable] = useState(supportsWebgl)
  const viewpoint = useRef<WalkViewpoint | null>(null),
    currentWalkLevel = useRef(''),
    mapRef = useRef<HTMLCanvasElement>(null),
    seenWalkRequest = useRef(0)
  const controllerOptions = useMemo(
    () => ({ ...walkOptions, roomId: selection?.kind === 'room' ? selection.id : undefined }),
    [walkOptions, selection],
  )
  const endWalk = useCallback(() => {
    setWalk(false)
    setLockedWalk(false)
    setDragWalk(false)
  }, [])
  const onCapture = useCallback((locked: boolean, dragging = false) => {
    setLockedWalk(locked)
    setDragWalk(dragging)
  }, [])
  const onWalkPosition = useCallback(
    (x: number, z: number, yaw: number, current: Level, foot: number, pitch: number) => {
      if (mapRef.current) drawWalkMap(mapRef.current, current, x, z, yaw)
      viewpoint.current = { id: '', name: '', levelId: current.id, point: { x, z }, foot, yaw, pitch }
      if (currentWalkLevel.current !== current.id) {
        currentWalkLevel.current = current.id
        setWalkLevel(current.name)
      }
    },
    [],
  )
  const toggleWalk = useCallback(() => {
    if (walk) {
      if (document.pointerLockElement) document.exitPointerLock()
      endWalk()
      return
    }
    if (!webglAvailable) {
      setError('Walkthrough requires WebGL. The building preview and editing remain available.')
      return
    }
    setSectionHeight(null)
    setVerticalSection(null)
    setLockedWalk(false)
    setDragWalk(false)
    setError('')
    setWalk(true)
  }, [walk, endWalk, webglAvailable, setSectionHeight, setVerticalSection])
  useEffect(() => {
    if (walkRequest > seenWalkRequest.current) {
      seenWalkRequest.current = walkRequest
      const frame = requestAnimationFrame(() => void toggleWalk())
      return () => cancelAnimationFrame(frame)
    }
  }, [walkRequest, walk, toggleWalk])
  useEffect(() => {
    onWalkChange?.(walk)
  }, [walk, onWalkChange])
  return {
    controllerOptions,
    dragWalk,
    endWalk,
    error,
    lockedWalk,
    mapRef,
    onCapture,
    onWalkPosition,
    setWalkOptions,
    toggleWalk,
    viewpoint,
    walk,
    walkLevel,
    walkOptions,
    webglAvailable,
  }
}
// The minimap host and the saved viewpoint are handed to the components that render or
// read them, so the object passed around the viewport never carries a ref.
export type WalkSession = Omit<ReturnType<typeof useWalkSession>, 'mapRef' | 'viewpoint'>
