import { api } from './api'
import { cachedRecords, getTask, putTask, putBlob, repository } from './cache'
import { loadLocalSource, saveLocalProject, saveSource } from '../state/database'
import { uid, type Project } from '../domain/types'
import { recordKey, type CloudRecord } from './types'
import { loadPrivateSource } from './sources'
import { connectionUnavailable } from './offline'
type Creation = { document: Project; idempotencyKey: string; complete?: boolean }
export async function createRemote(userId: string, document: Project, taskName: string, localSources = false) {
  const taskKey = `${userId}/create/${taskName}`
  let task = await getTask<Creation>(taskKey)
  if (!task || task.complete) {
    task = { document: structuredClone(document), idempotencyKey: crypto.randomUUID() }
    task.document.id = uid('project')
    await putTask(taskKey, task)
  }
  const key = recordKey(userId, task.document.id)
  if (localSources) for (const source of task.document.sources) {
    const blob = await loadLocalSource(source.id), original = await loadLocalSource(`${source.id}:original`)
    if (blob) await putBlob(key, source.id, blob)
    if (original) await putBlob(key, `${source.id}:original`, original)
  }
  await api.create(task.document, undefined, task.idempotencyKey)
  const snapshot = await api.load(task.document.id)
  await repository.put({ key, userId, base: snapshot, draft: snapshot.document })
  await putTask(taskKey, { ...task, complete: true })
  return snapshot.projectId
}
export async function remoteProjects(userId: string) {
  const records = await cachedRecords(userId)
  try {
    const projects: { id: string; name: string; revision: number;modified_at?:string }[] = []; let cursor: string | null = null
    do {
      const page: { items: typeof projects; nextCursor: string | null } = await api.request(`/projects?limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`)
      projects.push(...page.items); cursor = page.nextCursor
    } while (cursor)
    return { projects, cached: false, records }
  } catch (error) {
    if (!connectionUnavailable(error)) throw error
    return { projects: records.map(record => ({ id: record.base.projectId, name: record.draft.name, revision: record.base.revision,modified_at:new Date(record.draft.modified).toISOString() })), cached: true, records }
  }
}
export async function createFromTemplate(userId:string,templateId:string,duplicate:boolean) {
  const taskKey=`${userId}/template/${templateId}/${duplicate}`
  let task=await getTask<{key:string;projectId?:string}>(taskKey)
  if (!task || task.projectId) {task={key:crypto.randomUUID()};await putTask(taskKey,task)}
  const result=await api.request<{projectId:string}>(`/templates/${encodeURIComponent(templateId)}/projects`,'POST',{duplicate},task.key)
  const snapshot=await api.load(result.projectId),key=recordKey(userId,result.projectId)
  await repository.put({key,userId,base:snapshot,draft:snapshot.document})
  await putTask(taskKey,{...task,projectId:result.projectId})
  return result.projectId
}
export async function localCopy(record: CloudRecord) {
  const project = structuredClone(record.draft), projectId = record.base.projectId
  project.id = uid('project'); project.name += ' (local copy)'; project.modified = Date.now()
  for (const source of project.sources) {
    const previous = source.id, id = uid('source')
    const blob = await loadPrivateSource(record.key, projectId, previous)
    const original = source.mime === 'application/pdf' ? await loadPrivateSource(record.key, projectId, `${previous}:original`) : undefined
    if (!blob) throw new Error('Download the private source first, or export the geometry draft as JSON.')
    source.id = id; await saveSource(id, blob); if (original) await saveSource(`${id}:original`, original)
    for (const building of project.buildings) for (const level of building.levels) if (level.sourceId === previous) level.sourceId = id
  }
  await saveLocalProject(project); return project.id
}
