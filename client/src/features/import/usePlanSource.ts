import { useEffect, useRef, useState } from 'react'
import type { Project, SourceDocument } from '../../domain/types'
import { isCadMime, isPdfMime } from '../../domain/sourceMime'
import { loadSource, replaceProjectSource } from '../../state/database'
import { useProject } from '../../state/project'
import { readSource, type ScannedSource } from './readSource'
import { hasLevelGeometry } from '../../domain/replaceSource'
import { detectCadFile, type CadFormat } from './cadFormat'
import { importCadDrawing } from './cadImport'
import type { CadStage } from './cadTransfer'

const replacePrompt =
  'Replace this plan and clear its existing model, including furniture and structural details? Other floors are kept. Undo restores this floor.'

export function usePlanSource(project: Project, levelId: string, onReplaced: () => void) {
  const [activeUrl, setActiveUrl] = useState<{ id: string; url: string }>()
  const [error, setError] = useState('')
  const [pages, setPages] = useState(project.sources[0]?.pages || 1)
  const [file, setFile] = useState<File>()
  const [busy, setBusy] = useState(false)
  const [stage, setStage] = useState<CadStage | ''>('')
  const importGeneration = useRef(0)
  const setProject = useProject((s) => s.replaceDocument)
  const level =
    project.buildings[0].levels.find((item) => item.id === levelId) || project.buildings[0].levels[0]
  const source = project.sources.find((item) => item.id === level.sourceId)
  const sourceId = source?.id
  const url = sourceId && activeUrl?.id === sourceId ? activeUrl.url : undefined
  // A conversion can outlive the floor it started on, so every step re-checks its context.
  const context = () => {
    const current = useProject.getState().project
    const currentLevel = current?.buildings
      .flatMap((building) => building.levels)
      .find((item) => item.id === levelId)
    if (
      current?.id !== project.id ||
      !currentLevel ||
      currentLevel.sourceId !== sourceId ||
      useProject.getState().activeLevelId !== levelId ||
      useProject.getState().readOnly
    )
      return undefined
    return { current, currentLevel }
  }
  useEffect(() => {
    setPages(source?.pages || 1)
    setFile(undefined)
  }, [sourceId, source?.pages])
  useEffect(() => {
    let current = true,
      objectUrl = ''
    if (sourceId)
      loadSource(sourceId)
        .then((blob) => {
          if (!blob || !current) return
          objectUrl = URL.createObjectURL(blob)
          setActiveUrl({ id: sourceId, url: objectUrl })
        })
        .catch((cause) => {
          if (current) setError((cause as Error).message)
        })
    return () => {
      current = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [sourceId])
  useEffect(
    () => () => {
      importGeneration.current++
    },
    [],
  )
  const importFile = async (chosen: File, page = 1): Promise<boolean> => {
    if (useProject.getState().readOnly) {
      setError('This project is read only.')
      return false
    }
    const job = ++importGeneration.current
    setBusy(true)
    setError('')
    setStage('')
    try {
      const format = await detectCadFile(chosen)
      // A raster is decoded before the prompt so a bad image never clears the floor.
      const pending: { kind: 'raster'; scan: ScannedSource } | { kind: 'cad'; format: CadFormat } = format
        ? { kind: 'cad', format }
        : { kind: 'raster', scan: await readSource(chosen, page) }
      if (job !== importGeneration.current) return false
      const before = context()
      if (!before) return false
      const building = before.current.buildings.find((item) => item.levels.includes(before.currentLevel))
      if (sourceId && hasLevelGeometry(before.currentLevel, building) && !window.confirm(replacePrompt))
        return false
      const result: ScannedSource =
        pending.kind === 'raster'
          ? pending.scan
          : await importCadDrawing(before.current, chosen, pending.format, setStage)
      if (job !== importGeneration.current) return false
      const after = context()
      if (!after) return false
      const keepOriginal = isPdfMime(result.document.mime) || isCadMime(result.document.mime)
      const copy = await replaceProjectSource(
        after.current,
        result.document,
        result.blob,
        keepOriginal ? chosen : undefined,
        levelId,
      )
      if (job !== importGeneration.current || useProject.getState().project?.id !== project.id) return false
      onReplaced()
      setProject(copy)
      setPages(result.pages)
      setFile(chosen)
      return true
    } catch (cause) {
      if (job === importGeneration.current) setError((cause as Error).message)
    } finally {
      if (job === importGeneration.current) {
        setBusy(false)
        setStage('')
      }
    }
    return false
  }
  const selectPage = async (page: number): Promise<boolean> => {
    if (file) return importFile(file, page)
    if (!sourceId || !isPdfMime(source?.mime || '')) return false
    const original = await loadSource(`${sourceId}:original`)
    if (!original) {
      setError('The original PDF is unavailable. Import it again to choose another page.')
      return false
    }
    return importFile(new File([original], source.name, { type: 'application/pdf' }), page)
  }
  return {
    source: source as SourceDocument | undefined,
    url,
    error,
    pages,
    busy,
    stage,
    importFile,
    selectPage,
  }
}
