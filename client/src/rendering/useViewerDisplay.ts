import { useEffect, useRef, useState } from 'react'
import type { Building } from '../domain/types'
import type { CameraPreset } from './InspectionCamera'
import type { BuildingView } from './BuildingScene'

export type ViewerQuality = 'auto' | 'performance' | 'balanced' | 'high'

/** Every display choice the viewport toolbar exposes, plus the auto-widen to the whole building. */
export function useViewerDisplay({
  benchmark,
  building,
  wholeBuildingRequest,
}: {
  benchmark: boolean
  building: Building
  wholeBuildingRequest?: string
}) {
  const [top, setTop] = useState(false),
    [ceiling, setCeiling] = useState(false)
  const [roofCutaway, setRoofCutaway] = useState(false),
    [contextShown, setContextShown] = useState(false)
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('default')
  const [buildingView, setBuildingView] = useState<BuildingView>(
    building.levels.length > 1 ||
      building.systems?.systems.some((s) => s.kind === 'typical-floors' && s.visible !== false)
      ? 'building'
      : 'current',
  )
  const [sectionHeight, setSectionHeight] = useState<number | null>(null),
    [verticalSection, setVerticalSection] = useState<number | null>(null)
  const [quality, setQuality] = useState<ViewerQuality>(benchmark ? 'balanced' : 'auto')
  const [renderDpr, setRenderDpr] = useState(1)
  const [mapShown, setMapShown] = useState(true)
  const previousLevelCount = useRef(building.levels.length)
  useEffect(() => {
    if (wholeBuildingRequest) setBuildingView('building')
  }, [wholeBuildingRequest])
  useEffect(() => {
    if (building.levels.length > previousLevelCount.current) setBuildingView('building')
    previousLevelCount.current = building.levels.length
  }, [building.levels.length])
  return {
    buildingView,
    cameraPreset,
    ceiling,
    contextShown,
    mapShown,
    quality,
    renderDpr,
    roofCutaway,
    sectionHeight,
    setBuildingView,
    setCameraPreset,
    setCeiling,
    setContextShown,
    setMapShown,
    setQuality,
    setRenderDpr,
    setRoofCutaway,
    setSectionHeight,
    setTop,
    setVerticalSection,
    top,
    verticalSection,
  }
}
