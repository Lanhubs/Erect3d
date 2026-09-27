import { useEffect, useRef, useState } from 'react'
import type { Project, SourceDocument } from '../../domain/types'
import { loadSource, replaceProjectSource } from '../../state/database'
import { useProject } from '../../state/project'
import { readSource } from './readSource'

export function usePlanSource(project: Project, onReplaced: () => void) {
  const [activeUrl, setActiveUrl] = useState<{ id: string; url: string }>()
  const [error, setError] = useState('')
  const [pages, setPages] = useState(project.sources[0]?.pages || 1)
  const [file, setFile] = useState<File>()
  const [busy, setBusy] = useState(false)
  const importGeneration = useRef(0)
  const setProject = useProject(s => s.setProject)
  const source = project.sources[0]
  const sourceId = source?.id
  const url = sourceId && activeUrl?.id === sourceId ? activeUrl.url : undefined
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
    const job = ++importGeneration.current
    setBusy(true); setError('')
    try {
      const result = await readSource(chosen, page)
      if (job !== importGeneration.current) return false
      const hasGeometry = project.buildings.some(building => building.levels.some(level =>
        level.walls.length || level.doors.length || level.windows.length || level.rooms.length))
      if (sourceId && hasGeometry && !window.confirm('Replace this plan and discard geometry traced or reconstructed from it? This cannot be undone.')) return false
      const copy = await replaceProjectSource(project, result.document, result.blob,
        result.document.mime === 'application/pdf' ? chosen : undefined)
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
