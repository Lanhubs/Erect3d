import type { Database } from '../../db/connection'
import { projectSchema, documentSchemaVersion, type Project } from '../../contracts/project'
import { parse } from '../../contracts/http'
import { checksum } from '../../security/tokens'
import { ApiError, requireValue } from '../../security/errors'
import { applyChanges } from './patch'
import { normalizeProject } from '../../../../client/src/domain/levels'

export function migrateDocument(version: number, document: unknown): Project {
  if (version === 0) return parse(projectSchema, normalizeProject(structuredClone(document) as Project))
  if (version !== documentSchemaVersion)
    throw new ApiError(409, 'SCHEMA_VERSION', 'This document requires a newer API')
  return parse(projectSchema, document)
}
export async function loadDocument(db: Database, projectId: string, revision?: number) {
  const [project] = await db`SELECT revision FROM projects WHERE id=${projectId}`
  requireValue(project)
  const target = revision ?? Number(project.revision)
  const [snapshot] =
    await db`SELECT * FROM snapshots WHERE project_id=${projectId} AND revision<=${target} ORDER BY revision DESC LIMIT 1`
  requireValue(snapshot)
  if (checksum(snapshot.document) !== snapshot.checksum)
    throw new ApiError(503, 'CHECKSUM_MISMATCH', 'Stored document failed integrity verification')
  let document = migrateDocument(snapshot.schema_version, snapshot.document)
  const operations = await db`SELECT revision,type,payload FROM operations WHERE project_id=${projectId}
    AND revision>${snapshot.revision} AND revision<=${target} ORDER BY revision`
  let current = Number(snapshot.revision)
  for (const operation of operations) {
    if (Number(operation.revision) !== current + 1)
      throw new ApiError(503, 'REVISION_GAP', 'Document history is incomplete')
    if (operation.type === 'document.restore') document = operation.payload.document
    else document = applyChanges(document, operation.payload.changes, operation.payload.modifiedAt)
    current++
  }
  if (current !== target) throw new ApiError(404, 'NOT_FOUND', 'Revision not found')
  return {
    schemaVersion: documentSchemaVersion,
    projectId,
    revision: target,
    document: parse(projectSchema, document),
    checksum: checksum(document),
    createdAt: new Date(snapshot.created_at).toISOString(),
  }
}
export async function saveSnapshot(db: Database, projectId: string, revision: number, document: Project) {
  await db`INSERT INTO snapshots(project_id,revision,schema_version,document,checksum)
    VALUES (${projectId},${revision},${documentSchemaVersion},${document}::jsonb,${checksum(document)}) ON CONFLICT DO NOTHING`
}
