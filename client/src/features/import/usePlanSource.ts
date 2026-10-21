import { useEffect, useRef, useState } from 'react'
import type { Project, SourceDocument } from '../../domain/types'
import { loadSource, replaceProjectSource } from '../../state/database'
import { useProject } from '../../state/project'
import { readSource } from './readSource'
import { hasLevelGeometry } from '../../domain/replaceSource'

export function usePlanSource(project: Project, levelId: string, onReplaced: () => void) {
  const [activeUrl, setActiveUrl] = useState<{ id: string; url: string }>()
  const [error, setError] = useState('')
  const [pages, setPages] = useState(project.sources[0]?.pages || 1)
  const [file, setFile] = useState<File>()
  const [busy, setBusy] = useState(false)
  const importGeneration = useRef(0)
  const setProject = useProject(s => s.replaceDocument)
  const level = project.buildings[0].levels.find(item => item.id === levelId) || project.buildings[0].levels[0]
  const source = project.sources.find(item => item.id === level.sourceId)
  const sourceId = source?.id
  const url = sourceId && activeUrl?.id === sourceId ? activeUrl.url : undefined
  useEffect(() => { setPages(source?.pages || 1); setFile(undefined) }, [sourceId, source?.pages])
  useEffect(() => {
    let current = true, objectUrl = ''
    if (sourceId) loadSource(sourceId).then(blob => {
      if (!blob || !current) return
      objectUrl = URL.createObjectURL(blob); setActiveUrl({ id: sourceId, url: objectUrl })
    }).catch(cause => { if (current) setError((cause as Error).message) })
    return () => { current = false; if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [sourceId])
  useEffect(() => () => { importGeneration.current++ }, [])
  const importFile = async (chosen: File, page = 1): Promise<boolean> => {
    if (useProject.getState().readOnly) { setError('This project is read only.'); return false }
    const job = ++importGeneration.current
    setBusy(true); setError('')
    try {
      const result = await readSource(chosen, page)
      if (job !== importGeneration.current) return false
      const current = useProject.getState().project
      const currentLevel = current?.buildings.flatMap(building => building.levels).find(item => item.id === levelId)
      if (current?.id !== project.id || !currentLevel || currentLevel.sourceId !== sourceId || useProject.getState().activeLevelId !== levelId || useProject.getState().readOnly) return false
      const building = current.buildings.find(item => item.levels.includes(currentLevel))
      if (sourceId && hasLevelGeometry(currentLevel, building) && !window.confirm('Replace this plan and clear its existing model, including furniture and structural details? Other floors are kept. Undo restores this floor.')) return false
      const copy = await replaceProjectSource(current, result.document, result.blob,
        result.document.mime === 'application/pdf' ? chosen : undefined, levelId)
      if (job !== importGeneration.current || useProject.getState().project?.id !== project.id) return false
      onReplaced()
      setProject(copy)
      setPages(result.pages); setFile(chosen)
      return true
    } catch (cause) { if (job === importGeneration.current) setError((cause as Error).message) }
    finally { if (job === importGeneration.current) setBusy(false) }
    return false
  }
  const selectPage = async (page: number): Promise<boolean> => {
    if (file) return importFile(file, page)
    if (!sourceId || source?.mime !== 'application/pdf') return false
    const original = await loadSource(`${sourceId}:original`)
    if (!original) { setError('The original PDF is unavailable. Import it again to choose another page.'); return false }
    return importFile(new File([original], source.name, { type: 'application/pdf' }), page)
  }
  return { source: source as SourceDocument | undefined, url, error, pages, busy, importFile, selectPage }
}
